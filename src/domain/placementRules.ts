import type { ArchitectureGraph, ArchitectureZone, ArchitectureZoneId, CanvasPoint } from "./graph";

type PlacementSeverity = "warning" | "error";

type PlacementRule = {
  serviceId: string;
  zoneKinds: ArchitectureZone["kind"][];
  subnetAccess?: "public" | "private";
  hint: string;
  detail: string;
  recommendation: string;
  severity?: PlacementSeverity;
};

const placementRules: PlacementRule[] = [
  {
    serviceId: "aws-s3",
    zoneKinds: ["region", "data-tier", "edge", "global"],
    hint: "S3 is a managed regional service and should sit at the regional or data-service layer.",
    detail: "Amazon S3 is not deployed inside a subnet. Model it in the Region or a dedicated data-service lane rather than inside private or public subnets.",
    recommendation: "Place S3 in the Region or Data Tier, then connect application, analytics, or edge services to it.",
    severity: "warning",
  },
  {
    serviceId: "aws-efs",
    zoneKinds: ["subnet"],
    subnetAccess: "private",
    hint: "EFS should be modeled against private subnets with mount targets.",
    detail: "Amazon EFS is accessed through mount targets in VPC subnets and is usually modeled with private application subnets, not public internet-facing lanes.",
    recommendation: "Place EFS in a private subnet and connect EC2, Auto Scaling, or Lambda workloads that mount it.",
    severity: "warning",
  },
  {
    serviceId: "aws-api-gateway",
    zoneKinds: ["region", "edge", "global"],
    hint: "API Gateway should be modeled in a regional or edge lane, not inside a VPC or subnet.",
    detail: "API Gateway is a managed regional or edge-facing service. It should not be placed inside a VPC, Availability Zone, or subnet box.",
    recommendation: "Place API Gateway in the Region or Internet Edge layer, then connect it to Lambda, queues, or data services.",
    severity: "error",
  },
  {
    serviceId: "aws-internet-gateway",
    zoneKinds: ["vpc"],
    hint: "Internet Gateway attaches to a VPC boundary.",
    detail: "An Internet Gateway is a VPC attachment. It should be placed on the VPC layer rather than inside subnets or Availability Zones.",
    recommendation: "Move the Internet Gateway into the VPC scope and route public subnet traffic to it.",
    severity: "error",
  },
  {
    serviceId: "aws-nat-gateway",
    zoneKinds: ["subnet"],
    subnetAccess: "public",
    hint: "NAT Gateway must sit in a public subnet.",
    detail: "A NAT Gateway lives in a public subnet so private subnets can route outbound internet traffic through it.",
    recommendation: "Place the NAT Gateway in a public subnet and keep private subnet egress pointed to it.",
    severity: "error",
  },
  {
    serviceId: "aws-transit-gateway",
    zoneKinds: ["region"],
    hint: "Transit Gateway is a regional network hub.",
    detail: "Transit Gateway is modeled at the Region scope rather than inside a VPC or subnet.",
    recommendation: "Place Transit Gateway in the Region layer and connect VPC or hybrid attachments to it.",
    severity: "error",
  },
  {
    serviceId: "aws-vpn-gateway",
    zoneKinds: ["vpc"],
    hint: "Site-to-Site VPN / VGW attaches to a VPC boundary.",
    detail: "A Virtual Private Gateway is attached to a VPC. It should be modeled on the VPC layer instead of within subnets or Availability Zones.",
    recommendation: "Place the VPN gateway on the VPC boundary and connect it to the customer gateway or transit design.",
    severity: "error",
  },
  {
    serviceId: "aws-direct-connect",
    zoneKinds: ["region", "edge", "global"],
    hint: "Direct Connect should be shown at the regional or edge connectivity boundary.",
    detail: "Direct Connect is an external connectivity boundary service, not a subnet-resident resource.",
    recommendation: "Place Direct Connect at the Region or Edge layer and connect it to hybrid networking resources.",
    severity: "error",
  },
];

function getPlacementRule(serviceId: string) {
  return placementRules.find((rule) => rule.serviceId === serviceId);
}

function matchesRule(zone: ArchitectureZone, rule: PlacementRule) {
  if (!rule.zoneKinds.includes(zone.kind)) {
    return false;
  }

  if (rule.zoneKinds.includes("subnet") && rule.subnetAccess && zone.kind === "subnet") {
    return zone.config?.subnetAccess === rule.subnetAccess;
  }

  return true;
}

function getZone(graph: ArchitectureGraph, zoneId?: ArchitectureZoneId) {
  return zoneId ? graph.zones.find((zone) => zone.id === zoneId) : undefined;
}

function getZoneAncestry(graph: ArchitectureGraph, zoneId?: ArchitectureZoneId) {
  const ancestry: ArchitectureZone[] = [];
  let current = getZone(graph, zoneId);

  while (current) {
    ancestry.push(current);
    current = getZone(graph, current.parentZoneId);
  }

  return ancestry;
}

export function getPlacementConstraint(serviceId: string) {
  return getPlacementRule(serviceId);
}

export function getValidPlacementZoneIds(graph: ArchitectureGraph, serviceId: string) {
  const rule = getPlacementRule(serviceId);

  if (!rule) {
    return [];
  }

  return graph.zones.filter((zone) => matchesRule(zone, rule)).map((zone) => zone.id);
}

export function canPlaceServiceInZone(graph: ArchitectureGraph, serviceId: string, zoneId?: ArchitectureZoneId) {
  const rule = getPlacementRule(serviceId);

  if (!rule) {
    return true;
  }

  const zone = getZone(graph, zoneId);
  return zone ? matchesRule(zone, rule) : false;
}

export function resolvePlacementZoneId(graph: ArchitectureGraph, serviceId: string, preferredZoneId?: ArchitectureZoneId) {
  const rule = getPlacementRule(serviceId);

  if (!rule) {
    if (preferredZoneId && graph.zones.some((zone) => zone.id === preferredZoneId)) {
      return preferredZoneId;
    }

    return graph.zones[0]?.id;
  }

  const ancestryMatch = getZoneAncestry(graph, preferredZoneId).find((zone) => matchesRule(zone, rule));

  if (ancestryMatch) {
    return ancestryMatch.id;
  }

  return getValidPlacementZoneIds(graph, serviceId)[0];
}

export function getPlacementHint(serviceId: string) {
  return getPlacementRule(serviceId)?.hint;
}

export function getPlacementIssue(serviceId: string) {
  const rule = getPlacementRule(serviceId);

  if (!rule) {
    return undefined;
  }

  return {
    severity: rule.severity ?? "warning",
    detail: rule.detail,
    recommendation: rule.recommendation,
  };
}

export function getZoneAnchorPosition(zone: ArchitectureZone, serviceId: string): CanvasPoint | undefined {
  if (!zone.layout) {
    return undefined;
  }

  const { x, y, width, height } = zone.layout;

  switch (serviceId) {
    case "aws-internet-gateway":
      return { x: x + 3, y: y + (height / 2) };
    case "aws-vpn-gateway":
      return { x: x + width - 3, y: y + (height / 2) };
    case "aws-nat-gateway":
      return { x: x + (width / 2), y: y + Math.min(7, height * 0.24) };
    case "aws-api-gateway":
      return { x: x + (width / 2), y: y + Math.min(7, height * 0.18) };
    case "aws-transit-gateway":
      return { x: x + (width / 2), y: y + Math.min(8, height * 0.2) };
    case "aws-direct-connect":
      return { x: x + 4, y: y + Math.min(8, height * 0.22) };
    default:
      return { x: x + (width / 2), y: y + (height / 2) };
  }
}
