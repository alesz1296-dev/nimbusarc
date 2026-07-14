import type { ArchitectureGraph, ArchitectureNode, ArchitectureZone } from "./graph";
import type { CloudService } from "./types";

export type ArchitectureIssueSeverity = "error" | "warning";

export type ArchitectureIssue = {
  id: string;
  severity: ArchitectureIssueSeverity;
  title: string;
  detail: string;
  recommendation: string;
  nodeId?: string;
  zoneId?: string;
};

export type ArchitectureValidationAssessment = {
  issues: ArchitectureIssue[];
  errors: number;
  warnings: number;
  affectedNodeIds: string[];
};

function getZone(graph: ArchitectureGraph, zoneId?: string) {
  return zoneId ? graph.zones.find((zone) => zone.id === zoneId) : undefined;
}

function getZoneAncestry(graph: ArchitectureGraph, zoneId?: string) {
  const ancestry: ArchitectureZone[] = [];
  let current = getZone(graph, zoneId);

  while (current) {
    ancestry.push(current);
    current = getZone(graph, current.parentZoneId);
  }

  return ancestry;
}

function isInsideZoneKind(graph: ArchitectureGraph, node: ArchitectureNode, kind: ArchitectureZone["kind"]) {
  return getZoneAncestry(graph, node.zoneId).some((zone) => zone.kind === kind);
}

function nodeZoneKind(graph: ArchitectureGraph, node: ArchitectureNode) {
  return getZone(graph, node.zoneId)?.kind;
}

function isInPublicSubnet(graph: ArchitectureGraph, node: ArchitectureNode) {
  return getZoneAncestry(graph, node.zoneId).some((zone) => zone.kind === "subnet" && zone.config?.subnetAccess === "public");
}

function isInPrivateSubnet(graph: ArchitectureGraph, node: ArchitectureNode) {
  return getZoneAncestry(graph, node.zoneId).some((zone) => zone.kind === "subnet" && zone.config?.subnetAccess === "private");
}

function getSubnetAzKey(graph: ArchitectureGraph, zone: ArchitectureZone) {
  if (zone.config?.availabilityZoneName) return zone.config.availabilityZoneName;
  const ancestry = getZoneAncestry(graph, zone.id);
  const az = ancestry.find((candidate) => candidate.kind === "availability-zone");
  return az?.config?.availabilityZoneName ?? az?.label ?? zone.id;
}

function getNodeAzKey(graph: ArchitectureGraph, node: ArchitectureNode) {
  const ancestry = getZoneAncestry(graph, node.zoneId);
  const az = ancestry.find((candidate) => candidate.kind === "availability-zone");
  if (az) return az.config?.availabilityZoneName ?? az.label;
  const subnet = ancestry.find((candidate) => candidate.kind === "subnet");
  return subnet?.config?.availabilityZoneName ?? subnet?.label;
}

function getPrivateSubnetAzCount(graph: ArchitectureGraph) {
  const azKeys = new Set(
    graph.zones
      .filter((zone) => zone.kind === "subnet" && zone.config?.subnetAccess === "private")
      .map((zone) => getSubnetAzKey(graph, zone)),
  );
  return azKeys.size;
}

function getPublicSubnetAzCount(graph: ArchitectureGraph) {
  const azKeys = new Set(
    graph.zones
      .filter((zone) => zone.kind === "subnet" && zone.config?.subnetAccess === "public")
      .map((zone) => getSubnetAzKey(graph, zone)),
  );
  return azKeys.size;
}

function connectedNodes(graph: ArchitectureGraph, node: ArchitectureNode) {
  const connectedIds = new Set<string>();
  graph.edges.forEach((edge) => {
    if (edge.sourceNodeId === node.id) connectedIds.add(edge.targetNodeId);
    if (edge.targetNodeId === node.id) connectedIds.add(edge.sourceNodeId);
  });
  return graph.nodes.filter((candidate) => connectedIds.has(candidate.id));
}

function addIssue(issues: ArchitectureIssue[], issue: ArchitectureIssue) {
  issues.push(issue);
}

export function assessArchitectureValidation(graph: ArchitectureGraph, servicesById: Map<string, CloudService>): ArchitectureValidationAssessment {
  const issues: ArchitectureIssue[] = [];
  const publicSubnetAzCount = getPublicSubnetAzCount(graph);
  const privateSubnetAzCount = getPrivateSubnetAzCount(graph);

  graph.nodes.forEach((node) => {
    const serviceName = servicesById.get(node.serviceId)?.name ?? node.label;
    const zoneKind = nodeZoneKind(graph, node);

    if (node.serviceId === "aws-internet-gateway" && zoneKind !== "vpc") {
      addIssue(issues, {
        id: `${node.id}-igw-placement`,
        severity: "warning",
        title: `${serviceName} placement looks wrong`,
        detail: "An Internet Gateway attaches to a VPC and should be modeled at the VPC boundary, not inside a subnet, AZ, or edge lane.",
        recommendation: "Move the Internet Gateway into the VPC layer and connect public subnet routes to it.",
        nodeId: node.id,
      });
    }

    if (node.serviceId === "aws-alb") {
      if (!node.config.multiAz && !node.config.highAvailability) {
        addIssue(issues, {
          id: `${node.id}-alb-multiaz-config`,
          severity: "error",
          title: `${serviceName} should span multiple AZs`,
          detail: "A highly available public ALB should be associated with subnets in at least two Availability Zones.",
          recommendation: "Enable Multi-AZ/high availability and place public subnets in at least two AZs.",
          nodeId: node.id,
        });
      }

      if (publicSubnetAzCount < 2) {
        addIssue(issues, {
          id: `${node.id}-alb-public-subnets`,
          severity: "error",
          title: `${serviceName} needs public subnet A and B`,
          detail: `Only ${publicSubnetAzCount} public AZ subnet group is modeled. SAA web architectures usually need at least two public subnets for a public ALB.`,
          recommendation: "Add one public subnet in each of two AZs, then associate the ALB with both.",
          nodeId: node.id,
        });
      }
    }

    if (node.serviceId === "aws-auto-scaling") {
      const connectedEc2Azs = new Set(
        connectedNodes(graph, node)
          .filter((candidate) => candidate.serviceId === "aws-ec2")
          .map((candidate) => getNodeAzKey(graph, candidate))
          .filter(Boolean),
      );

      if (!node.config.multiAz && !node.config.highAvailability) {
        addIssue(issues, {
          id: `${node.id}-asg-multiaz-config`,
          severity: "warning",
          title: `${serviceName} should span both AZs`,
          detail: "An Auto Scaling group for an SAA-style highly available app should span at least two AZs.",
          recommendation: "Enable Multi-AZ/high availability and model EC2 capacity in both app subnets.",
          nodeId: node.id,
        });
      }

      if (connectedEc2Azs.size < 2) {
        addIssue(issues, {
          id: `${node.id}-asg-ec2-targets`,
          severity: "warning",
          title: `${serviceName} needs EC2 instances shown across AZs`,
          detail: "The group is not visually tied to EC2 instances in two different Availability Zones.",
          recommendation: "Add EC2 nodes in two AZs and connect them to the Auto Scaling group, or mark the group as abstract Multi-AZ capacity.",
          nodeId: node.id,
        });
      }
    }

    if (node.serviceId === "aws-rds") {
      if (!isInPrivateSubnet(graph, node)) {
        addIssue(issues, {
          id: `${node.id}-rds-private-placement`,
          severity: "error",
          title: `${serviceName} should be private`,
          detail: "RDS should normally live in private database subnets for SAA web architectures.",
          recommendation: "Move RDS into a private data subnet and remove public access unless the scenario explicitly requires it.",
          nodeId: node.id,
        });
      }

      if ((node.config.multiAz || node.config.highAvailability) && privateSubnetAzCount < 2) {
        addIssue(issues, {
          id: `${node.id}-rds-db-subnets`,
          severity: "error",
          title: `${serviceName} needs DB subnet A and B`,
          detail: `Only ${privateSubnetAzCount} private AZ subnet group is modeled. Multi-AZ RDS requires DB subnets across multiple AZs.`,
          recommendation: "Add private database subnets in at least two AZs and place RDS in the data tier.",
          nodeId: node.id,
        });
      }
    }

    if (node.serviceId === "aws-nat-gateway" && !isInPublicSubnet(graph, node)) {
      addIssue(issues, {
        id: `${node.id}-nat-public-subnet`,
        severity: "error",
        title: `${serviceName} must be in a public subnet`,
        detail: "A NAT Gateway sits in a public subnet and provides outbound internet access for private subnets.",
        recommendation: "Move NAT Gateway to a public subnet and route private subnet egress through it.",
        nodeId: node.id,
      });
    }

    if (node.serviceId === "aws-ec2" && node.config.publicAccess && !isInPublicSubnet(graph, node)) {
      addIssue(issues, {
        id: `${node.id}-ec2-public-access-placement`,
        severity: "warning",
        title: `${serviceName} public access conflicts with placement`,
        detail: "The instance is configured for public access but is not placed in a public subnet.",
        recommendation: "Either move it to a public subnet for bastion-style access or keep it private and remove public access.",
        nodeId: node.id,
      });
    }

    if (node.serviceId === "aws-vpc" && !isInsideZoneKind(graph, node, "region")) {
      addIssue(issues, {
        id: `${node.id}-vpc-region-placement`,
        severity: "warning",
        title: `${serviceName} should sit inside a Region`,
        detail: "A VPC is regional. Modeling it outside a Region makes AZ and subnet checks harder to reason about.",
        recommendation: "Place the VPC inside the AWS Region layer.",
        nodeId: node.id,
      });
    }
  });

  graph.edges.forEach((edge) => {
    const source = graph.nodes.find((node) => node.id === edge.sourceNodeId);
    const target = graph.nodes.find((node) => node.id === edge.targetNodeId);

    if (!source || !target) return;

    if (source.serviceId === "aws-cloudwatch" && target.serviceId !== "aws-cloudwatch") {
      addIssue(issues, {
        id: `${edge.id}-cloudwatch-direction`,
        severity: "warning",
        title: "CloudWatch arrow direction looks reversed",
        detail: "Metrics, logs, and alarms usually originate from resources and flow into CloudWatch.",
        recommendation: "Reverse this observability connection so the resource points to CloudWatch.",
        nodeId: source.id,
      });
    }
  });

  const affectedNodeIds = [...new Set(issues.map((issue) => issue.nodeId).filter(Boolean) as string[])];

  return {
    issues,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    affectedNodeIds,
  };
}
