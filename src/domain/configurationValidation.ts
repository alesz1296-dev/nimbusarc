import type { ArchitectureGraph, ArchitectureNode, ArchitectureRoute, ArchitectureRouteTable, ArchitectureZone } from "./graph";

export type ConfigurationIssueSeverity = "error" | "warning";

export type ConfigurationIssue = {
  id: string;
  severity: ConfigurationIssueSeverity;
  title: string;
  detail: string;
  recommendation: string;
  nodeId?: string;
  zoneId?: string;
};

export type ConfigurationAssessment = {
  issues: ConfigurationIssue[];
  errors: number;
  warnings: number;
  affectedNodeIds: string[];
  affectedZoneIds: string[];
};

function isValidIpv4Cidr(value?: string) {
  if (!value) return true;
  const match = value.match(/^(\d{1,3}\.){3}\d{1,3}\/(\d|[12]\d|3[0-2])$/);
  if (!match) return false;
  const [ip] = value.split("/");
  return ip.split(".").every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
}

function isValidIpv6Cidr(value?: string) {
  if (!value) return true;
  const [ip, prefix] = value.split("/");
  const parsedPrefix = Number(prefix);
  return Boolean(ip?.includes(":")) && Number.isInteger(parsedPrefix) && parsedPrefix >= 0 && parsedPrefix <= 128;
}

function addIssue(issues: ConfigurationIssue[], issue: ConfigurationIssue) {
  issues.push(issue);
}

function findRouteTableForSubnet(graph: ArchitectureGraph, subnetId: string): ArchitectureRouteTable | undefined {
  return (graph.routeTables ?? []).find((routeTable) => routeTable.associatedSubnetIds.includes(subnetId));
}

type ZoneRouteTarget = NonNullable<ArchitectureZone["config"]>["routeTarget"];

function getDefaultRouteTarget(routeTable?: ArchitectureRouteTable, fallbackTarget?: ZoneRouteTarget) {
  const defaultRoute = routeTable?.routes.find((route) => route.destination === "0.0.0.0/0" || route.destination === "::/0");
  return defaultRoute?.targetType ?? fallbackTarget;
}

function getDefaultRoute(routeTable?: ArchitectureRouteTable) {
  return routeTable?.routes.find((route) => route.destination === "0.0.0.0/0" || route.destination === "::/0");
}

const routeTargetServiceMap: Partial<Record<ArchitectureRoute["targetType"], string[]>> = {
  "internet-gateway": ["aws-internet-gateway"],
  "nat-gateway": ["aws-nat-gateway"],
  "transit-gateway": ["aws-transit-gateway"],
  "vpn-gateway": ["aws-vpn-gateway"],
  "vpc-endpoint": ["aws-vpc-endpoint"],
};

function findZone(graph: ArchitectureGraph, zoneId?: string) {
  return zoneId ? graph.zones.find((zone) => zone.id === zoneId) : undefined;
}

function getZoneAncestry(graph: ArchitectureGraph, zoneId?: string) {
  const ancestry: ArchitectureZone[] = [];
  let cursor = findZone(graph, zoneId);

  while (cursor) {
    ancestry.push(cursor);
    cursor = findZone(graph, cursor.parentZoneId);
  }

  return ancestry;
}

function nodeIsInZoneKind(graph: ArchitectureGraph, node: ArchitectureNode, kind: ArchitectureZone["kind"]) {
  return getZoneAncestry(graph, node.zoneId).some((zone) => zone.kind === kind);
}

function nodeIsInSubnetAccess(graph: ArchitectureGraph, node: ArchitectureNode, subnetAccess: "public" | "private") {
  return getZoneAncestry(graph, node.zoneId).some((zone) => zone.kind === "subnet" && zone.config?.subnetAccess === subnetAccess);
}

function validateRouteTarget(issues: ConfigurationIssue[], graph: ArchitectureGraph, zone: ArchitectureZone, routeTable: ArchitectureRouteTable, route: ArchitectureRoute) {
  if (route.targetType === "local") {
    return;
  }

  const expectedServiceIds = routeTargetServiceMap[route.targetType] ?? [];

  if (!route.targetId) {
    addIssue(issues, {
      id: `${zone.id}-${route.id}-missing-target-resource`,
      severity: "warning",
      title: `${zone.label} route target is not selected`,
      detail: `${routeTable.label} has a ${route.destination} route to ${route.targetType}, but it does not point to a placed gateway resource.`,
      recommendation: "Open the route table and choose the actual placed gateway node as the target resource.",
      zoneId: zone.id,
    });
    return;
  }

  const targetNode = graph.nodes.find((node) => node.id === route.targetId);

  if (!targetNode) {
    addIssue(issues, {
      id: `${zone.id}-${route.id}-target-not-found`,
      severity: "error",
      title: `${zone.label} route points to a missing resource`,
      detail: `${routeTable.label} points ${route.destination} to ${route.targetId}, but that resource is not on the canvas.`,
      recommendation: "Pick an existing gateway target from the route table inspector.",
      zoneId: zone.id,
    });
    return;
  }

  if (expectedServiceIds.length > 0 && !expectedServiceIds.includes(targetNode.serviceId)) {
    addIssue(issues, {
      id: `${zone.id}-${route.id}-target-type-mismatch`,
      severity: "error",
      title: `${zone.label} route target type does not match`,
      detail: `${routeTable.label} expects ${route.targetType}, but ${targetNode.label} is a different service type.`,
      recommendation: "Choose a target resource that matches the selected route target type.",
      zoneId: zone.id,
      nodeId: targetNode.id,
    });
  }

  if (route.targetType === "internet-gateway" && !nodeIsInZoneKind(graph, targetNode, "vpc")) {
    addIssue(issues, {
      id: `${zone.id}-${route.id}-igw-placement`,
      severity: "error",
      title: `${targetNode.label} should attach to the VPC boundary`,
      detail: "Internet Gateways attach to a VPC, not to an individual subnet.",
      recommendation: "Move the Internet Gateway onto the VPC scope.",
      zoneId: zone.id,
      nodeId: targetNode.id,
    });
  }

  if (route.targetType === "nat-gateway" && !nodeIsInSubnetAccess(graph, targetNode, "public")) {
    addIssue(issues, {
      id: `${zone.id}-${route.id}-nat-placement`,
      severity: "error",
      title: `${targetNode.label} must be in a public subnet`,
      detail: "NAT Gateway is used by private subnet route tables but the NAT Gateway itself must sit in a public subnet.",
      recommendation: "Move the NAT Gateway into a public subnet with a route to an Internet Gateway.",
      zoneId: zone.id,
      nodeId: targetNode.id,
    });
  }
}

export function assessArchitectureConfiguration(graph: ArchitectureGraph): ConfigurationAssessment {
  const issues: ConfigurationIssue[] = [];

  graph.zones.forEach((zone) => {
    const config = zone.config ?? {};
    const family = config.ipAddressFamily ?? "ipv4";
    const cidr4 = config.cidrIpv4 ?? config.cidrBlock;
    const cidr6 = config.cidrIpv6;

    if ((family === "ipv4" || family === "dualstack") && cidr4 && !isValidIpv4Cidr(cidr4)) {
      addIssue(issues, {
        id: `${zone.id}-invalid-ipv4`,
        severity: "error",
        title: `${zone.label} has an invalid IPv4 CIDR`,
        detail: `${cidr4} is not a valid IPv4 network block for the selected address family.`,
        recommendation: "Use a network address with a prefix from /0 through /32, such as 10.0.0.0/16.",
        zoneId: zone.id,
      });
    }

    if ((family === "ipv6" || family === "dualstack") && cidr6 && !isValidIpv6Cidr(cidr6)) {
      addIssue(issues, {
        id: `${zone.id}-invalid-ipv6`,
        severity: "error",
        title: `${zone.label} has an invalid IPv6 CIDR`,
        detail: `${cidr6} is not a valid IPv6 network block for the selected address family.`,
        recommendation: "Use an IPv6 block with a prefix from /0 through /128, such as 2001:db8::/56.",
        zoneId: zone.id,
      });
    }

    if (family === "ipv4" && cidr6) {
      addIssue(issues, {
        id: `${zone.id}-unexpected-ipv6`,
        severity: "error",
        title: `${zone.label} contains IPv6 configuration while IPv4-only is selected`,
        detail: "The zone address family does not allow an IPv6 CIDR.",
        recommendation: "Remove the IPv6 CIDR or switch the address family to dual-stack/IPv6.",
        zoneId: zone.id,
      });
    }

    if (family === "ipv6" && cidr4) {
      addIssue(issues, {
        id: `${zone.id}-unexpected-ipv4`,
        severity: "error",
        title: `${zone.label} contains IPv4 configuration while IPv6-only is selected`,
        detail: "The zone address family does not allow an IPv4 CIDR.",
        recommendation: "Remove the IPv4 CIDR or switch the address family to dual-stack/IPv4.",
        zoneId: zone.id,
      });
    }

    if (zone.kind === "subnet") {
      const routeTable = findRouteTableForSubnet(graph, zone.id);
      const defaultRoute = getDefaultRoute(routeTable);
      const defaultRouteTarget = getDefaultRouteTarget(routeTable, config.routeTarget);

      if (!routeTable && !config.routeTableName?.trim()) {
        addIssue(issues, {
          id: `${zone.id}-missing-route-table`,
          severity: "error",
          title: `${zone.label} has no route table`,
          detail: "Subnet traffic cannot be reasoned about until a route table is associated.",
          recommendation: "Add a route table and choose its default route target.",
          zoneId: zone.id,
        });
      }

      if (routeTable?.routes.some((route) => route.status === "blackhole" || route.status === "invalid")) {
        addIssue(issues, {
          id: `${zone.id}-route-table-invalid-route`,
          severity: "error",
          title: `${zone.label} has an unhealthy route`,
          detail: "One or more routes in the associated route table are marked blackhole or invalid.",
          recommendation: "Open the route table and repair or remove invalid routes.",
          zoneId: zone.id,
        });
      }

      routeTable?.routes.forEach((route) => validateRouteTarget(issues, graph, zone, routeTable, route));

      if (config.subnetAccess === "public" && defaultRouteTarget !== "internet-gateway") {
        addIssue(issues, {
          id: `${zone.id}-public-route`,
          severity: "warning",
          title: `${zone.label} is public but has no Internet Gateway route`,
          detail: "A public subnet needs a route to an Internet Gateway for public internet access.",
          recommendation: "Set the route target to Internet Gateway, or mark the subnet private.",
          zoneId: zone.id,
        });
      }

      if (config.subnetAccess === "private" && defaultRouteTarget === "internet-gateway") {
        addIssue(issues, {
          id: `${zone.id}-private-route`,
          severity: "error",
          title: `${zone.label} is private but routes directly to an Internet Gateway`,
          detail: "Private subnets should not have a direct Internet Gateway route.",
          recommendation: "Use a NAT Gateway, VPC endpoint, transit path, or local-only routing.",
          zoneId: zone.id,
        });
      }

      if (config.subnetAccess === "private" && defaultRouteTarget === "nat-gateway") {
        const targetNatNode = defaultRoute?.targetId
          ? graph.nodes.find((node) => node.id === defaultRoute.targetId)
          : undefined;
        const hasNatInPublicSubnet = targetNatNode
          ? nodeIsInSubnetAccess(graph, targetNatNode, "public")
          : graph.nodes.some((node) => node.serviceId === "aws-nat-gateway" && nodeIsInSubnetAccess(graph, node, "public"));

        if (!hasNatInPublicSubnet) {
          addIssue(issues, {
            id: `${zone.id}-nat-target-missing`,
            severity: "warning",
            title: `${zone.label} routes to NAT but no public NAT Gateway is modeled`,
            detail: "Private subnet outbound internet paths need a NAT Gateway placed in a public subnet.",
            recommendation: "Add a NAT Gateway to a public subnet, or change the route target to VPC Endpoint/local-only if the subnet is isolated.",
            zoneId: zone.id,
          });
        }
      }
    }
  });

  const zoneById = new Map(graph.zones.map((zone) => [zone.id, zone]));
  const findParent = (zone: ArchitectureZone) => zone.parentZoneId ? zoneById.get(zone.parentZoneId) : undefined;

  graph.zones.forEach((zone) => {
    if (zone.kind === "availability-zone" && findParent(zone)?.kind !== "vpc") {
      addIssue(issues, {
        id: `${zone.id}-az-parent`,
        severity: "warning",
        title: `${zone.label} is not inside a VPC`,
        detail: "Availability Zones are regional boundaries but the current model expects them under a VPC for this exercise.",
        recommendation: "Assign the Availability Zone to the correct VPC scope.",
        zoneId: zone.id,
      });
    }

    if (zone.kind === "subnet" && findParent(zone)?.kind !== "availability-zone" && !zone.config?.availabilityZoneName) {
      addIssue(issues, {
        id: `${zone.id}-subnet-parent`,
        severity: "warning",
        title: `${zone.label} is not assigned to an Availability Zone`,
        detail: "A subnet must belong to exactly one Availability Zone in the visual model.",
        recommendation: "Move the subnet into its Availability Zone scope.",
        zoneId: zone.id,
      });
    }
  });

  return {
    issues,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    affectedNodeIds: [],
    affectedZoneIds: [...new Set(issues.map((issue) => issue.zoneId).filter(Boolean) as string[])],
  };
}
