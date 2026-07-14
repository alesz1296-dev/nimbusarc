import type { ArchitectureGraph, ArchitectureZone } from "./graph";

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
      if (!config.routeTableName?.trim()) {
        addIssue(issues, {
          id: `${zone.id}-missing-route-table`,
          severity: "error",
          title: `${zone.label} has no route table`,
          detail: "Subnet traffic cannot be reasoned about until a route table is associated.",
          recommendation: "Add a route table and choose its default route target.",
          zoneId: zone.id,
        });
      }

      if (config.subnetAccess === "public" && config.routeTarget !== "internet-gateway") {
        addIssue(issues, {
          id: `${zone.id}-public-route`,
          severity: "warning",
          title: `${zone.label} is public but has no Internet Gateway route`,
          detail: "A public subnet needs a route to an Internet Gateway for public internet access.",
          recommendation: "Set the route target to Internet Gateway, or mark the subnet private.",
          zoneId: zone.id,
        });
      }

      if (config.subnetAccess === "private" && config.routeTarget === "internet-gateway") {
        addIssue(issues, {
          id: `${zone.id}-private-route`,
          severity: "error",
          title: `${zone.label} is private but routes directly to an Internet Gateway`,
          detail: "Private subnets should not have a direct Internet Gateway route.",
          recommendation: "Use a NAT Gateway, VPC endpoint, transit path, or local-only routing.",
          zoneId: zone.id,
        });
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
