import type { ArchitectureGraph, ArchitectureNode } from "./graph";
import type { CloudService } from "./types";

export type SecurityFindingSeverity = "critical" | "warning" | "pass";

export type SecurityFinding = {
  id: string;
  severity: SecurityFindingSeverity;
  title: string;
  detail: string;
  nodeId?: string;
  edgeId?: string;
};

export type SecurityAssessment = {
  findings: SecurityFinding[];
  passed: number;
  warnings: number;
  blocked: number;
};

function isDataStore(serviceId: string) {
  return ["aws-rds", "aws-dynamodb", "aws-s3", "aws-elasticache"].includes(serviceId);
}

function hasIdentityRequirement(serviceId: string) {
  return ["aws-ec2", "aws-lambda", "aws-s3", "aws-dynamodb", "aws-rds", "aws-sqs", "aws-sns"].includes(serviceId);
}

export function assessArchitectureSecurity(graph: ArchitectureGraph, servicesById: Map<string, CloudService>): SecurityAssessment {
  const findings: SecurityFinding[] = [];

  graph.nodes.forEach((node) => {
    const service = servicesById.get(node.serviceId);

    if (!service) return;

    if (isDataStore(node.serviceId) && node.config.publicAccess) {
      findings.push({ id: `${node.id}-public-data`, severity: "critical", title: `${service.name} is publicly accessible`, detail: "Move the data store to a private subnet or remove public access unless the scenario explicitly requires it.", nodeId: node.id });
    }

    if (isDataStore(node.serviceId) && node.config.encryptionAtRest === false) {
      findings.push({ id: `${node.id}-encryption`, severity: "warning", title: `${service.name} encryption is disabled`, detail: "Enable encryption at rest for protected data and exam-ready designs.", nodeId: node.id });
    }

    if (hasIdentityRequirement(node.serviceId) && node.config.iamPolicyMode === "none") {
      findings.push({ id: `${node.id}-iam-none`, severity: "critical", title: `${service.name} has no IAM permissions`, detail: "The service cannot call dependent AWS APIs until an execution or resource policy is assigned.", nodeId: node.id });
    }

    if (node.config.iamPolicyMode === "broad") {
      findings.push({ id: `${node.id}-iam-broad`, severity: "warning", title: `${service.name} uses broad permissions`, detail: "Replace wildcard permissions with a resource-scoped least-privilege policy.", nodeId: node.id });
    }

    if (hasIdentityRequirement(node.serviceId) && !node.config.iamRoleName && node.config.iamPolicyMode !== "none") {
      findings.push({ id: `${node.id}-iam-role`, severity: "warning", title: `${service.name} has no named IAM role`, detail: "Model an execution or service role so learners can reason about trust policies and permissions.", nodeId: node.id });
    }

    if (node.config.scpMode === "deny") {
      findings.push({ id: `${node.id}-scp`, severity: "critical", title: `${service.name} is denied by SCP`, detail: "The modeled organization service control policy blocks this resource action even if IAM allows it.", nodeId: node.id });
    }

    if (!node.config.tagsText?.trim()) {
      findings.push({ id: `${node.id}-tags`, severity: "warning", title: `${service.name} has no resource tags`, detail: "Add tags for ownership, cost allocation, environment, and governance tracking.", nodeId: node.id });
    }

    if (node.config.publicAccess && ["aws-alb", "aws-api-gateway", "aws-cloudfront"].includes(node.serviceId) && !node.config.enableManagedRules) {
      findings.push({ id: `${node.id}-edge-firewall`, severity: "warning", title: `${service.name} has no modeled WAF protection`, detail: "Consider a WAF or equivalent edge rule set for public HTTP entry points.", nodeId: node.id });
    }

    if (node.config.firewallMode === "deny") {
      findings.push({ id: `${node.id}-firewall`, severity: "critical", title: `${service.name} firewall denies flows`, detail: "Any connected path to this service will be blocked by the simulated host or web firewall.", nodeId: node.id });
    }
  });

  graph.edges.forEach((edge) => {
    const source = graph.nodes.find((node) => node.id === edge.sourceNodeId);
    const target = graph.nodes.find((node) => node.id === edge.targetNodeId);

    if (!source || !target) return;

    const sourceName = servicesById.get(source.serviceId)?.name ?? source.label;
    const targetName = servicesById.get(target.serviceId)?.name ?? target.label;
    const controls = edge.controls ?? {};

    if (controls.routeAllowed === false || controls.securityGroupAllowed === false || controls.networkAclAllowed === false || controls.dnsAllowed === false || controls.iamAllowed === false || controls.scpAllowed === false || source.config.firewallMode === "deny" || target.config.firewallMode === "deny" || target.config.securityGroupMode === "deny" || source.config.scpMode === "deny" || target.config.scpMode === "deny") {
      findings.push({ id: `${edge.id}-blocked`, severity: "critical", title: `${sourceName} to ${targetName} is blocked`, detail: "Route tables, DNS, IAM, SCPs, security groups, NACLs, or firewall controls deny this path.", edgeId: edge.id });
    } else {
      findings.push({ id: `${edge.id}-pass`, severity: "pass", title: `${sourceName} to ${targetName} is allowed`, detail: "The modeled network controls permit this connection.", edgeId: edge.id });
    }
  });

  return {
    findings,
    passed: findings.filter((finding) => finding.severity === "pass").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    blocked: findings.filter((finding) => finding.severity === "critical").length,
  };
}
