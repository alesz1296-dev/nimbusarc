import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureRoute,
  ArchitectureRouteTable,
  ArchitectureZone,
  EdgeSimulationResult,
  FlowSimulationSnapshot,
  NodeSimulationResult,
} from "./graph";

function isValidIpv4Cidr(value?: string) {
  if (!value) return true;
  const match = value.match(/^(\d{1,3}\.){3}\d{1,3}\/(\d|[12]\d|3[0-2])$/);
  if (!match) return false;
  const [ip] = value.split("/");
  return ip.split(".").every((segment) => {
    const parsed = Number(segment);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255;
  });
}

function isValidIpv6Cidr(value?: string) {
  if (!value) return true;
  const [ip, prefix] = value.split("/");
  if (!ip || !prefix) return false;
  const parsedPrefix = Number(prefix);
  if (!Number.isInteger(parsedPrefix) || parsedPrefix < 0 || parsedPrefix > 128) return false;
  return ip.includes(":");
}

function getZone(graph: ArchitectureGraph, zoneId?: string) {
  return graph.zones.find((zone) => zone.id === zoneId);
}

function getNode(graph: ArchitectureGraph, nodeId?: string) {
  return graph.nodes.find((node) => node.id === nodeId);
}

function findZoneChain(graph: ArchitectureGraph, zoneId?: string) {
  const chain: ArchitectureZone[] = [];
  let cursor = getZone(graph, zoneId);

  while (cursor) {
    chain.push(cursor);
    cursor = cursor.parentZoneId ? getZone(graph, cursor.parentZoneId) : undefined;
  }

  return chain;
}

function findSubnetForNode(graph: ArchitectureGraph, node?: ArchitectureNode) {
  return findZoneChain(graph, node?.zoneId).find((zone) => zone.kind === "subnet");
}

function findVpcForNode(graph: ArchitectureGraph, node?: ArchitectureNode) {
  return findZoneChain(graph, node?.zoneId).find((zone) => zone.kind === "vpc");
}

function findRouteTableForSubnet(graph: ArchitectureGraph, subnetId?: string) {
  return subnetId ? (graph.routeTables ?? []).find((routeTable) => routeTable.associatedSubnetIds.includes(subnetId)) : undefined;
}

function findDefaultRoute(routeTable?: ArchitectureRouteTable) {
  return routeTable?.routes.find((route) => route.destination === "0.0.0.0/0" || route.destination === "::/0");
}

function describeRouteTarget(route: ArchitectureRoute, graph: ArchitectureGraph) {
  if (route.targetId) {
    const targetNode = getNode(graph, route.targetId);

    if (targetNode) {
      return targetNode.label;
    }
  }

  switch (route.targetType) {
    case "internet-gateway":
      return "Internet Gateway";
    case "nat-gateway":
      return "NAT Gateway";
    case "transit-gateway":
      return "Transit Gateway";
    case "vpn-gateway":
      return "VPN Gateway";
    case "vpc-endpoint":
      return "VPC Endpoint";
    case "egress-only-igw":
      return "Egress-only Internet Gateway";
    default:
      return "local";
  }
}

function nodeIsInPublicSubnet(graph: ArchitectureGraph, node?: ArchitectureNode) {
  return findZoneChain(graph, node?.zoneId).some((zone) => zone.kind === "subnet" && zone.config?.subnetAccess === "public");
}

function nodeIsPlacedOnVpcBoundary(graph: ArchitectureGraph, node?: ArchitectureNode) {
  return getZone(graph, node?.zoneId)?.kind === "vpc";
}

function hasSameVpc(graph: ArchitectureGraph, left?: ArchitectureNode, right?: ArchitectureNode) {
  const leftVpc = findVpcForNode(graph, left)?.id;
  const rightVpc = findVpcForNode(graph, right)?.id;

  return Boolean(leftVpc && rightVpc && leftVpc === rightVpc);
}

function validateNatGatewayPath(graph: ArchitectureGraph, workloadNode: ArchitectureNode, natNode: ArchitectureNode) {
  if (!hasSameVpc(graph, workloadNode, natNode)) {
    return `${workloadNode.label} and ${natNode.label} are not in the same VPC`;
  }

  const workloadSubnet = findSubnetForNode(graph, workloadNode);

  if (!workloadSubnet) {
    return `${workloadNode.label} is not placed in a subnet, so it has no route table path`;
  }

  const routeTable = findRouteTableForSubnet(graph, workloadSubnet.id);
  const defaultRoute = findDefaultRoute(routeTable);

  if (!defaultRoute) {
    return `${workloadSubnet.label} has no default route to reach ${natNode.label}`;
  }

  if (defaultRoute.targetType !== "nat-gateway") {
    return `${workloadSubnet.label} routes ${defaultRoute.destination} to ${describeRouteTarget(defaultRoute, graph)} instead of a NAT Gateway`;
  }

  if (defaultRoute.targetId && defaultRoute.targetId !== natNode.id) {
    return `${workloadSubnet.label} routes to a different NAT Gateway than ${natNode.label}`;
  }

  if (!nodeIsInPublicSubnet(graph, natNode)) {
    return `${natNode.label} is not in a public subnet`;
  }

  return undefined;
}

function validateInternetGatewayPath(graph: ArchitectureGraph, workloadNode: ArchitectureNode, igwNode: ArchitectureNode) {
  if (!hasSameVpc(graph, workloadNode, igwNode)) {
    return `${workloadNode.label} and ${igwNode.label} are not in the same VPC`;
  }

  if (!nodeIsPlacedOnVpcBoundary(graph, igwNode)) {
    return `${igwNode.label} is not placed on the VPC boundary`;
  }

  const workloadSubnet = findSubnetForNode(graph, workloadNode);

  if (!workloadSubnet) {
    return `${workloadNode.label} is not placed in a subnet, so it has no route table path`;
  }

  const routeTable = findRouteTableForSubnet(graph, workloadSubnet.id);
  const defaultRoute = findDefaultRoute(routeTable);

  if (!defaultRoute) {
    return `${workloadSubnet.label} has no default route to reach the Internet Gateway`;
  }

  if (defaultRoute.targetType === "internet-gateway") {
    if (defaultRoute.targetId && defaultRoute.targetId !== igwNode.id) {
      return `${workloadSubnet.label} routes to a different Internet Gateway than ${igwNode.label}`;
    }

    return undefined;
  }

  if (defaultRoute.targetType !== "nat-gateway") {
    return `${workloadSubnet.label} routes ${defaultRoute.destination} to ${describeRouteTarget(defaultRoute, graph)} instead of an Internet path`;
  }

  const natNode = defaultRoute.targetId ? getNode(graph, defaultRoute.targetId) : undefined;

  if (!natNode) {
    return `${workloadSubnet.label} needs a selected NAT Gateway before it can reach ${igwNode.label}`;
  }

  const natPathBlock = validateNatGatewayPath(graph, workloadNode, natNode);

  if (natPathBlock) {
    return natPathBlock;
  }

  const natSubnet = findSubnetForNode(graph, natNode);
  const natRouteTable = findRouteTableForSubnet(graph, natSubnet?.id);
  const natDefaultRoute = findDefaultRoute(natRouteTable);

  if (!natDefaultRoute) {
    return `${natSubnet?.label ?? natNode.label} has no default route to an Internet Gateway`;
  }

  if (natDefaultRoute.targetType !== "internet-gateway") {
    return `${natSubnet?.label ?? natNode.label} routes ${natDefaultRoute.destination} to ${describeRouteTarget(natDefaultRoute, graph)} instead of an Internet Gateway`;
  }

  if (natDefaultRoute.targetId && natDefaultRoute.targetId !== igwNode.id) {
    return `${natNode.label} egress points to a different Internet Gateway than ${igwNode.label}`;
  }

  return undefined;
}

function validateGatewayEdgePath(edge: ArchitectureEdge, graph: ArchitectureGraph) {
  const source = getNode(graph, edge.sourceNodeId);
  const target = getNode(graph, edge.targetNodeId);

  if (!source || !target) {
    return undefined;
  }

  const pair = new Set([source.serviceId, target.serviceId]);

  if (pair.has("aws-nat-gateway") && pair.has("aws-internet-gateway")) {
    const natNode = source.serviceId === "aws-nat-gateway" ? source : target;
    const igwNode = source.serviceId === "aws-internet-gateway" ? source : target;
    const natSubnet = findSubnetForNode(graph, natNode);
    const natRouteTable = findRouteTableForSubnet(graph, natSubnet?.id);
    const natDefaultRoute = findDefaultRoute(natRouteTable);

    if (!nodeIsInPublicSubnet(graph, natNode)) {
      return `${natNode.label} is not in a public subnet`;
    }

    if (!nodeIsPlacedOnVpcBoundary(graph, igwNode)) {
      return `${igwNode.label} is not placed on the VPC boundary`;
    }

    if (!natDefaultRoute) {
      return `${natSubnet?.label ?? natNode.label} has no default route to an Internet Gateway`;
    }

    if (natDefaultRoute.targetType !== "internet-gateway") {
      return `${natSubnet?.label ?? natNode.label} routes ${natDefaultRoute.destination} to ${describeRouteTarget(natDefaultRoute, graph)} instead of an Internet Gateway`;
    }

    if (natDefaultRoute.targetId && natDefaultRoute.targetId !== igwNode.id) {
      return `${natNode.label} egress points to a different Internet Gateway than ${igwNode.label}`;
    }

    return undefined;
  }

  if (pair.has("aws-nat-gateway")) {
    const natNode = source.serviceId === "aws-nat-gateway" ? source : target;
    const workloadNode = natNode.id === source.id ? target : source;
    return validateNatGatewayPath(graph, workloadNode, natNode);
  }

  if (pair.has("aws-internet-gateway")) {
    const igwNode = source.serviceId === "aws-internet-gateway" ? source : target;
    const workloadNode = igwNode.id === source.id ? target : source;
    return validateInternetGatewayPath(graph, workloadNode, igwNode);
  }

  return undefined;
}

function firstInvalidZone(graph: ArchitectureGraph, zoneId?: string) {
  return findZoneChain(graph, zoneId).find((zone) => {
    const family = zone.config?.ipAddressFamily ?? "ipv4";
    if ((family === "ipv4" || family === "dualstack") && zone.config?.cidrIpv4 && !isValidIpv4Cidr(zone.config.cidrIpv4)) {
      return true;
    }
    if ((family === "ipv6" || family === "dualstack") && zone.config?.cidrIpv6 && !isValidIpv6Cidr(zone.config.cidrIpv6)) {
      return true;
    }
    if (family === "ipv4" && zone.config?.cidrIpv6) {
      return true;
    }
    if (family === "ipv6" && (zone.config?.cidrIpv4 || zone.config?.cidrBlock)) {
      return true;
    }
    return false;
  });
}

function routeBlocksZone(graph: ArchitectureGraph, zone?: ArchitectureZone) {
  if (!zone?.config) return undefined;
  if (zone.config.networkAclMode === "deny") return `Network ACL denies traffic in ${zone.label}`;
  if (zone.kind === "subnet") {
    const routeTable = (graph.routeTables ?? []).find((candidate) => candidate.associatedSubnetIds.includes(zone.id));
    const defaultRoute = routeTable?.routes.find((route) => route.destination === "0.0.0.0/0" || route.destination === "::/0");
    const defaultTarget = defaultRoute?.targetType ?? zone.config.routeTarget;

    if (defaultRoute?.status === "blackhole" || defaultRoute?.status === "invalid") {
      return `${zone.label} has an unhealthy default route`;
    }

    if (zone.config.subnetAccess === "public" && defaultTarget !== "internet-gateway") {
      return `${zone.label} is marked public but its route table has no internet path`;
    }

    if (zone.config.subnetAccess === "private" && defaultTarget === "internet-gateway") {
      return `${zone.label} is private but routes directly to an Internet Gateway`;
    }
  }
  return undefined;
}

function dnsBlocksEdge(edge: ArchitectureEdge, graph: ArchitectureGraph) {
  const controls = edge.controls ?? {};
  if (!controls.dnsRequired) return undefined;
  if (controls.dnsAllowed === false) return "DNS resolution is blocked";

  const sourceZone = getZone(graph, graph.nodes.find((node) => node.id === edge.sourceNodeId)?.zoneId);
  const targetZone = getZone(graph, graph.nodes.find((node) => node.id === edge.targetNodeId)?.zoneId);
  const sourceDnsEnabled = sourceZone?.config?.dnsResolution ?? true;
  const targetDnsEnabled = targetZone?.config?.dnsResolution ?? true;

  if (!sourceDnsEnabled || !targetDnsEnabled) {
    return "DNS support is disabled for one side of the flow";
  }

  return undefined;
}

function iamBlocksEdge(edge: ArchitectureEdge, graph: ArchitectureGraph) {
  const controls = edge.controls ?? {};
  if (!controls.iamRequired) return undefined;
  if (controls.iamAllowed === false) return "IAM authorization denies the flow";
  if (controls.scpAllowed === false) return "Service control policy denies the flow";

  const source = graph.nodes.find((node) => node.id === edge.sourceNodeId);
  const target = graph.nodes.find((node) => node.id === edge.targetNodeId);
  if (source?.config.scpMode === "deny" || target?.config.scpMode === "deny") {
    return "An organization SCP denies this action";
  }
  if (source?.config.iamPolicyMode === "none") {
    return "Source service has no IAM role or policy";
  }
  return undefined;
}

function isBlockedBy(edge: ArchitectureEdge, graph: ArchitectureGraph) {
  const controls = edge.controls ?? {};

  if (controls.routeAllowed === false) {
    return "Route table has no usable path";
  }

  if (controls.securityGroupAllowed === false) {
    return "Security group blocks the flow";
  }

  if (controls.networkAclAllowed === false) {
    return "Network ACL blocks the flow";
  }

  const source = graph.nodes.find((node) => node.id === edge.sourceNodeId);
  const target = graph.nodes.find((node) => node.id === edge.targetNodeId);
  const invalidZone = firstInvalidZone(graph, source?.zoneId) ?? firstInvalidZone(graph, target?.zoneId);

  if (invalidZone) {
    return `${invalidZone.label} has an invalid CIDR configuration`;
  }

  const sourceZoneChain = findZoneChain(graph, source?.zoneId);
  const targetZoneChain = findZoneChain(graph, target?.zoneId);
  const routeBlock =
    sourceZoneChain.map((zone) => routeBlocksZone(graph, zone)).find(Boolean) ??
    targetZoneChain.map((zone) => routeBlocksZone(graph, zone)).find(Boolean);

  if (routeBlock) {
    return routeBlock;
  }

  const gatewayPathBlock = validateGatewayEdgePath(edge, graph);
  if (gatewayPathBlock) {
    return gatewayPathBlock;
  }

  const dnsBlock = dnsBlocksEdge(edge, graph);
  if (dnsBlock) {
    return dnsBlock;
  }

  const iamBlock = iamBlocksEdge(edge, graph);
  if (iamBlock) {
    return iamBlock;
  }

  return undefined;
}

export function createIdleSimulation(): FlowSimulationSnapshot {
  return {
    status: "idle",
    edges: [],
    nodes: [],
  };
}

export function simulateArchitectureGraph(graph: ArchitectureGraph): FlowSimulationSnapshot {
  const edgeResults: EdgeSimulationResult[] = graph.edges.map((edge) => {
    const reason = isBlockedBy(edge, graph);

    return {
      edgeId: edge.id,
      status: reason ? "blocked" : "flowing",
      reason,
    };
  });

  const flowingNodeIds = new Set<string>();
  const blockedNodeIds = new Set<string>();

  graph.edges.forEach((edge) => {
    const result = edgeResults.find((edgeResult) => edgeResult.edgeId === edge.id);

    if (result?.status === "blocked") {
      blockedNodeIds.add(edge.sourceNodeId);
      blockedNodeIds.add(edge.targetNodeId);
      return;
    }

    flowingNodeIds.add(edge.sourceNodeId);
    flowingNodeIds.add(edge.targetNodeId);
  });

  const nodeResults: NodeSimulationResult[] = graph.nodes.map((node) => {
    const desiredCapacity = node.config.desiredCapacity ?? (
      node.serviceId === "aws-auto-scaling" ? 2 : node.serviceId === "aws-ec2" ? 1 : undefined
    );

    if (blockedNodeIds.has(node.id) && !flowingNodeIds.has(node.id)) {
      return {
        nodeId: node.id,
        status: "blocked",
        instanceCount: desiredCapacity,
        reason: "No successful flow reaches this service",
      };
    }

    if (desiredCapacity) {
      return {
        nodeId: node.id,
        status: "running",
        instanceCount: desiredCapacity,
        reason: `Running ${desiredCapacity} instance${desiredCapacity === 1 ? "" : "s"}`,
      };
    }

    return {
      nodeId: node.id,
      status: flowingNodeIds.has(node.id) ? "flowing" : "idle",
    };
  });

  const blockedCount = edgeResults.filter((edgeResult) => edgeResult.status === "blocked").length;
  const flowingCount = edgeResults.length - blockedCount;

  return {
    status: "completed",
    lastRunAt: new Date().toISOString(),
    edges: edgeResults,
    nodes: nodeResults,
    summary:
      blockedCount > 0
        ? `${flowingCount} flow${flowingCount === 1 ? "" : "s"} passed, ${blockedCount} blocked.`
        : `${flowingCount} flow${flowingCount === 1 ? "" : "s"} passed.`,
  };
}
