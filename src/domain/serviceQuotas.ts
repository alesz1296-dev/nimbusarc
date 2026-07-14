import type { ArchitectureGraph, ArchitectureNode, ArchitectureZone } from "./graph";
import type { CloudService } from "./types";

export type QuotaScope = "account-region" | "availability-zone" | "vpc" | "subnet" | "account-global";
export type QuotaFindingSeverity = "pass" | "warning" | "critical";

export type ServiceQuotaDefinition = {
  id: string;
  serviceId: string;
  name: string;
  scope: QuotaScope;
  defaultLimit: number;
  unit: string;
  adjustable: boolean;
  description: string;
  examSignal: string;
};

export type QuotaFinding = {
  id: string;
  quotaId: string;
  severity: QuotaFindingSeverity;
  title: string;
  detail: string;
  usage: number;
  limit: number;
  unit: string;
  scope: QuotaScope;
};

export type ServiceQuotaAssessment = {
  findings: QuotaFinding[];
  passed: number;
  warnings: number;
  blocked: number;
  disclaimer: string;
};

export const starterAwsServiceQuotas: ServiceQuotaDefinition[] = [
  {
    id: "ec2-running-instances-region",
    serviceId: "aws-ec2",
    name: "Running EC2 instance-style capacity",
    scope: "account-region",
    defaultLimit: 20,
    unit: "instances",
    adjustable: true,
    description: "Educational regional baseline for EC2-like running capacity, including EC2 nodes and Auto Scaling desired capacity.",
    examSignal: "SAA designs should think in scalable fleets and account quotas, not infinite instance placement.",
  },
  {
    id: "elastic-ips-region",
    serviceId: "aws-ec2",
    name: "Elastic IP addresses",
    scope: "account-region",
    defaultLimit: 5,
    unit: "EIPs",
    adjustable: true,
    description: "Common regional default for Elastic IPs. NAT gateways and public fixed endpoints can consume this quickly.",
    examSignal: "Prefer DNS/load balancers and private networking over attaching public IPs everywhere.",
  },
  {
    id: "albs-region",
    serviceId: "aws-alb",
    name: "Application Load Balancers",
    scope: "account-region",
    defaultLimit: 50,
    unit: "load balancers",
    adjustable: true,
    description: "Regional baseline for ALB count.",
    examSignal: "Use listeners, rules, and target groups before creating unnecessary load balancers.",
  },
  {
    id: "target-groups-region",
    serviceId: "aws-alb",
    name: "Target groups",
    scope: "account-region",
    defaultLimit: 300,
    unit: "target groups",
    adjustable: true,
    description: "Regional target group baseline used by ALB/NLB designs.",
    examSignal: "Target groups model routing boundaries, health checks, and blue/green rollout shape.",
  },
  {
    id: "nat-gateways-az",
    serviceId: "aws-nat-gateway",
    name: "NAT gateways per Availability Zone",
    scope: "availability-zone",
    defaultLimit: 5,
    unit: "NAT gateways",
    adjustable: true,
    description: "Per-AZ NAT gateway baseline.",
    examSignal: "Place NAT gateways per AZ for resilience, but watch cost and quota growth.",
  },
  {
    id: "lambda-concurrency-region",
    serviceId: "aws-lambda",
    name: "Lambda regional concurrency",
    scope: "account-region",
    defaultLimit: 1000,
    unit: "concurrent executions",
    adjustable: true,
    description: "Regional concurrency baseline for Lambda workloads.",
    examSignal: "Concurrency limits can throttle event-driven architectures and downstream services.",
  },
  {
    id: "rds-db-instances-region",
    serviceId: "aws-rds",
    name: "RDS DB instances",
    scope: "account-region",
    defaultLimit: 40,
    unit: "DB instances",
    adjustable: true,
    description: "Regional RDS instance baseline, including read replicas in this simulator.",
    examSignal: "Multi-AZ is not the same as read scaling; replicas and instances both affect capacity planning.",
  },
  {
    id: "ebs-volumes-region",
    serviceId: "aws-ebs",
    name: "EBS volumes",
    scope: "account-region",
    defaultLimit: 5000,
    unit: "volumes",
    adjustable: true,
    description: "Regional EBS volume baseline. EC2 root and attached data volumes both count here.",
    examSignal: "Storage quotas, snapshots, and volume type choices matter for resilient stateful designs.",
  },
  {
    id: "s3-buckets-account",
    serviceId: "aws-s3",
    name: "S3 buckets",
    scope: "account-global",
    defaultLimit: 100,
    unit: "buckets",
    adjustable: true,
    description: "Account-level starter baseline for S3 buckets.",
    examSignal: "Bucket naming, account boundaries, policies, and lifecycle design matter more than creating one bucket per object type.",
  },
  {
    id: "vpcs-region",
    serviceId: "aws-vpc",
    name: "VPCs per Region",
    scope: "account-region",
    defaultLimit: 5,
    unit: "VPCs",
    adjustable: true,
    description: "Regional VPC baseline.",
    examSignal: "Prefer clear account/VPC boundaries and routing strategy over uncontrolled network sprawl.",
  },
  {
    id: "subnets-vpc",
    serviceId: "aws-subnet",
    name: "Subnets per VPC",
    scope: "vpc",
    defaultLimit: 200,
    unit: "subnets",
    adjustable: true,
    description: "Baseline subnet count per VPC.",
    examSignal: "Subnet design should follow AZ, route table, and public/private access boundaries.",
  },
];

function countNodes(graph: ArchitectureGraph, serviceId: string) {
  return graph.nodes.filter((node) => node.serviceId === serviceId).length;
}

function countEc2Capacity(graph: ArchitectureGraph) {
  return graph.nodes.reduce((total, node) => {
    if (node.serviceId === "aws-ec2") return total + Math.max(1, node.config.desiredCapacity ?? 1);
    if (node.serviceId === "aws-auto-scaling") return total + Math.max(1, node.config.desiredCapacity ?? 2);
    return total;
  }, 0);
}

function countElasticIps(graph: ArchitectureGraph) {
  return graph.nodes.reduce((total, node) => {
    if (node.serviceId === "aws-nat-gateway") return total + 1;
    if (node.serviceId === "aws-ec2" && node.config.publicAccess) return total + Math.max(1, node.config.desiredCapacity ?? 1);
    return total;
  }, 0);
}

function countTargetGroups(graph: ArchitectureGraph) {
  return graph.nodes.reduce((total, node) => {
    if (node.serviceId === "aws-alb" || node.serviceId === "aws-nlb") {
      return total + Math.max(1, node.config.targetGroupCount ?? 1);
    }
    return total;
  }, 0);
}

function countLambdaConcurrency(graph: ArchitectureGraph) {
  return graph.nodes.reduce((total, node) => {
    if (node.serviceId !== "aws-lambda") return total;
    return total + Math.max(10, node.config.desiredCapacity ?? 10);
  }, 0);
}

function countRdsInstances(graph: ArchitectureGraph) {
  return graph.nodes.reduce((total, node) => {
    if (node.serviceId !== "aws-rds") return total;
    return total + 1 + Math.max(0, node.config.readReplicas ?? 0);
  }, 0);
}

function countEbsVolumes(graph: ArchitectureGraph) {
  return graph.nodes.reduce((total, node) => {
    if (node.serviceId === "aws-ebs") return total + 1;
    if (node.serviceId !== "aws-ec2") return total;
    return total + Math.max(1, node.config.desiredCapacity ?? 1) + Math.max(0, node.config.ec2DataVolumeCount ?? 0);
  }, 0);
}

function findParentZone(graph: ArchitectureGraph, zone: ArchitectureZone, kind: ArchitectureZone["kind"]) {
  let current = zone;
  while (current.parentZoneId) {
    const parent = graph.zones.find((candidate) => candidate.id === current.parentZoneId);
    if (!parent) return undefined;
    if (parent.kind === kind) return parent;
    current = parent;
  }
  return undefined;
}

function countNatGatewaysPerAz(graph: ArchitectureGraph) {
  const counts = new Map<string, number>();
  graph.nodes.filter((node) => node.serviceId === "aws-nat-gateway").forEach((node) => {
    const zone = node.zoneId ? graph.zones.find((candidate) => candidate.id === node.zoneId) : undefined;
    const az = zone?.kind === "availability-zone" ? zone : zone ? findParentZone(graph, zone, "availability-zone") : undefined;
    const key = az?.config?.availabilityZoneName ?? az?.label ?? "Unassigned AZ";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function countSubnetsPerVpc(graph: ArchitectureGraph) {
  const counts = new Map<string, number>();
  graph.zones.filter((zone) => zone.kind === "subnet").forEach((subnet) => {
    const vpc = findParentZone(graph, subnet, "vpc");
    const key = vpc?.label ?? "Unassigned VPC";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function getUsageForQuota(graph: ArchitectureGraph, quota: ServiceQuotaDefinition) {
  if (quota.id === "ec2-running-instances-region") return [{ scopeLabel: "Region", usage: countEc2Capacity(graph) }];
  if (quota.id === "elastic-ips-region") return [{ scopeLabel: "Region", usage: countElasticIps(graph) }];
  if (quota.id === "albs-region") return [{ scopeLabel: "Region", usage: countNodes(graph, "aws-alb") }];
  if (quota.id === "target-groups-region") return [{ scopeLabel: "Region", usage: countTargetGroups(graph) }];
  if (quota.id === "lambda-concurrency-region") return [{ scopeLabel: "Region", usage: countLambdaConcurrency(graph) }];
  if (quota.id === "rds-db-instances-region") return [{ scopeLabel: "Region", usage: countRdsInstances(graph) }];
  if (quota.id === "ebs-volumes-region") return [{ scopeLabel: "Region", usage: countEbsVolumes(graph) }];
  if (quota.id === "s3-buckets-account") return [{ scopeLabel: "Account", usage: countNodes(graph, "aws-s3") }];
  if (quota.id === "vpcs-region") return [{ scopeLabel: "Region", usage: graph.zones.filter((zone) => zone.kind === "vpc").length }];

  if (quota.id === "nat-gateways-az") {
    const counts = countNatGatewaysPerAz(graph);
    return counts.size ? [...counts.entries()].map(([scopeLabel, usage]) => ({ scopeLabel, usage })) : [{ scopeLabel: "Availability Zone", usage: 0 }];
  }

  if (quota.id === "subnets-vpc") {
    const counts = countSubnetsPerVpc(graph);
    return counts.size ? [...counts.entries()].map(([scopeLabel, usage]) => ({ scopeLabel, usage })) : [{ scopeLabel: "VPC", usage: 0 }];
  }

  return [{ scopeLabel: "Region", usage: 0 }];
}

function severityForUsage(usage: number, limit: number): QuotaFindingSeverity {
  if (usage > limit) return "critical";
  if (usage >= limit * 0.8 && usage > 0) return "warning";
  return "pass";
}

export function assessServiceQuotas(graph: ArchitectureGraph, servicesById: Map<string, CloudService>): ServiceQuotaAssessment {
  const findings = starterAwsServiceQuotas.flatMap((quota) => {
    const serviceName = servicesById.get(quota.serviceId)?.name ?? quota.name;
    return getUsageForQuota(graph, quota).map(({ scopeLabel, usage }) => {
      const severity = severityForUsage(usage, quota.defaultLimit);
      const adjustableText = quota.adjustable ? "This quota is usually adjustable, but designs should still call it out." : "This quota is usually fixed.";

      return {
        id: `${quota.id}-${scopeLabel}`,
        quotaId: quota.id,
        severity,
        title: `${quota.name}: ${usage}/${quota.defaultLimit} ${quota.unit}`,
        detail: `${scopeLabel} ${serviceName} usage. ${quota.examSignal} ${adjustableText}`,
        usage,
        limit: quota.defaultLimit,
        unit: quota.unit,
        scope: quota.scope,
      };
    });
  });

  return {
    findings,
    passed: findings.filter((finding) => finding.severity === "pass").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    blocked: findings.filter((finding) => finding.severity === "critical").length,
    disclaimer: "Starter educational quota baseline only. AWS Service Quotas vary by account, Region, partition, service adoption, and approved quota increases.",
  };
}
