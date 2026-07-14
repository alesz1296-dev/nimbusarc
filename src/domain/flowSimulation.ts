import type {
  ArchitectureEdge,
  ArchitectureGraph,
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

function findZoneChain(graph: ArchitectureGraph, zoneId?: string) {
  const chain: ArchitectureZone[] = [];
  let cursor = getZone(graph, zoneId);

  while (cursor) {
    chain.push(cursor);
    cursor = cursor.parentZoneId ? getZone(graph, cursor.parentZoneId) : undefined;
  }

  return chain;
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
