import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { ExternalLink, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import type { ArchitectureEdge, ArchitectureEdgeKind, ArchitectureNode, ArchitectureNodeConfig, ArchitectureZone } from "../../domain/graph";
import type { CacheEntryPreview, CloudService, DocumentCollectionPreview, RelationalTablePreview } from "../../domain/types";
import { AwsServiceIcon } from "../../ui/AwsServiceIcon";
import { Panel } from "../../ui/Panel";

type ArchitectureInspectorProps = {
  edge?: ArchitectureEdge;
  node?: ArchitectureNode;
  zone?: ArchitectureZone;
  service?: CloudService;
  servicesById?: Map<string, CloudService>;
  onClose?: () => void;
  onUpdateEdge: (changes: Partial<Pick<ArchitectureEdge, "kind" | "label" | "direction" | "controls">>) => void;
  onUpdateNodeConfig: (changes: ArchitectureNode["config"]) => void;
  onUpdateNodeLabel: (label: string) => void;
  onUpdateZone: (changes: Partial<Pick<ArchitectureZone, "label" | "description" | "config">>) => void;
};

const edgeKinds: Array<{ value: ArchitectureEdgeKind; label: string }> = [
  { value: "request", label: "Request" },
  { value: "data", label: "Data" },
  { value: "event", label: "Event" },
  { value: "observe", label: "Observability" },
];

const awsAvailabilityZones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c",
  "us-east-2a",
  "us-east-2b",
  "us-west-2a",
  "us-west-2b",
  "us-west-2c",
  "eu-west-1a",
  "eu-west-1b",
  "eu-west-1c",
];

const routeTargets = [
  { label: "Local only", value: "local-only" },
  { label: "Internet Gateway", value: "internet-gateway" },
  { label: "NAT Gateway", value: "nat-gateway" },
  { label: "Egress-only IGW", value: "egress-only-igw" },
  { label: "Transit Gateway", value: "transit-gateway" },
  { label: "Site-to-Site VPN", value: "vpn-gateway" },
  { label: "VPC Endpoint", value: "vpc-endpoint" },
] as const;

type InspectorField =
  | { kind: "toggle"; key: keyof ArchitectureNodeConfig; label: string }
  | { kind: "number"; key: keyof ArchitectureNodeConfig; label: string; min?: number; max?: number; step?: number }
  | { kind: "select"; key: keyof ArchitectureNodeConfig; label: string; options: Array<{ label: string; value: string }> }
  | { kind: "text"; key: keyof ArchitectureNodeConfig; label: string; placeholder?: string };

type ServiceInspectorTemplate = {
  title: string;
  description: string;
  fields: InspectorField[];
};

const baseServiceTemplates: Record<string, ServiceInspectorTemplate> = {
  Actors: {
    title: "External traffic source",
    description: "Actor nodes model request origin and should stay outside AWS trust boundaries.",
    fields: [
      { kind: "toggle", key: "publicAccess", label: "Public internet origin" },
    ],
  },
  Networking: {
    title: "Network path",
    description: "Model routing intent, public/private exposure, and hybrid connectivity.",
    fields: [
      { kind: "toggle", key: "publicAccess", label: "Internet reachable" },
      { kind: "toggle", key: "highAvailability", label: "Redundant path" },
    ],
  },
  Edge: {
    title: "Edge delivery",
    description: "Tune edge entry points for latency, origin protection, and public exposure.",
    fields: [
      { kind: "toggle", key: "publicAccess", label: "Public distribution" },
      { kind: "number", key: "cacheTtlSeconds", label: "Default TTL seconds", min: 0 },
      { kind: "toggle", key: "accessLogging", label: "Access logging" },
    ],
  },
  Compute: {
    title: "Compute workload",
    description: "Capture scale, resilience, subnet placement, and runtime visibility.",
    fields: [
      { kind: "number", key: "desiredCapacity", label: "Desired capacity", min: 0 },
      { kind: "toggle", key: "highAvailability", label: "High availability" },
      { kind: "toggle", key: "multiAz", label: "Multi-AZ" },
      { kind: "toggle", key: "publicAccess", label: "Public access" },
      { kind: "select", key: "securityGroupMode", label: "Security group", options: [{ label: "Allow configured flows", value: "allow" }, { label: "Deny flows", value: "deny" }] },
      { kind: "select", key: "iamPolicyMode", label: "IAM policy", options: [{ label: "Least privilege", value: "least-privilege" }, { label: "Broad permissions", value: "broad" }, { label: "No permissions", value: "none" }] },
      { kind: "select", key: "firewallMode", label: "Host firewall", options: [{ label: "Allow configured flows", value: "allow" }, { label: "Deny flows", value: "deny" }] },
      { kind: "toggle", key: "alarmEnabled", label: "CloudWatch alarms" },
    ],
  },
  Storage: {
    title: "Storage behavior",
    description: "Storage choices should expose durability, lifecycle, access, and encryption tradeoffs.",
    fields: [
      { kind: "toggle", key: "encryptionAtRest", label: "Encryption at rest" },
      { kind: "toggle", key: "versioning", label: "Versioning" },
      { kind: "toggle", key: "lifecycleRules", label: "Lifecycle rules" },
      { kind: "toggle", key: "publicAccess", label: "Public access" },
    ],
  },
  Database: {
    title: "Data store",
    description: "Database settings should reflect durability, scaling, backup, and access pattern choices.",
    fields: [
      { kind: "toggle", key: "encryptionAtRest", label: "Encryption at rest" },
      { kind: "toggle", key: "multiAz", label: "Multi-AZ" },
      { kind: "number", key: "readReplicas", label: "Read replicas", min: 0, max: 15 },
      { kind: "toggle", key: "deletionProtection", label: "Deletion protection" },
      { kind: "select", key: "securityGroupMode", label: "Security group", options: [{ label: "Allow configured flows", value: "allow" }, { label: "Deny flows", value: "deny" }] },
    ],
  },
  "Application Integration": {
    title: "Integration pattern",
    description: "Model decoupling, retry behavior, fanout, throttling, and event routing.",
    fields: [
      { kind: "toggle", key: "deadLetterQueue", label: "Dead-letter queue" },
      { kind: "toggle", key: "alarmEnabled", label: "Alarms" },
      { kind: "select", key: "iamPolicyMode", label: "IAM policy", options: [{ label: "Least privilege", value: "least-privilege" }, { label: "Broad permissions", value: "broad" }, { label: "No permissions", value: "none" }] },
    ],
  },
  Analytics: {
    title: "Analytics pipeline",
    description: "Capture streaming, retention, search, and observability assumptions.",
    fields: [
      { kind: "toggle", key: "encryptionAtRest", label: "Encryption at rest" },
      { kind: "toggle", key: "multiAz", label: "Multi-AZ" },
      { kind: "toggle", key: "accessLogging", label: "Access logging" },
    ],
  },
  Security: {
    title: "Security control",
    description: "Security services should describe policy, encryption, filtering, and audit intent.",
    fields: [
      { kind: "toggle", key: "leastPrivilege", label: "Least privilege" },
      { kind: "toggle", key: "accessLogging", label: "Logging enabled" },
    ],
  },
  Operations: {
    title: "Operations signal",
    description: "Operational services model logs, metrics, audit trails, and response triggers.",
    fields: [
      { kind: "toggle", key: "alarmEnabled", label: "Alarms enabled" },
      { kind: "toggle", key: "accessLogging", label: "Log collection" },
    ],
  },
};

const serviceTemplates: Record<string, Partial<ServiceInspectorTemplate>> = {
  "aws-alb": {
    title: "Application Load Balancer",
    description: "Configure Layer 7 entry, traffic distribution, and target health.",
    fields: [
      { kind: "toggle", key: "publicAccess", label: "Internet-facing" },
      { kind: "toggle", key: "multiAz", label: "Cross-zone / Multi-AZ" },
      { kind: "number", key: "trafficSharePercent", label: "Traffic share %", min: 0, max: 100, step: 0.1 },
      { kind: "number", key: "targetGroupCount", label: "Target groups", min: 0, max: 12 },
      { kind: "number", key: "targetsPerGroup", label: "Targets per group", min: 0, max: 100 },
      { kind: "toggle", key: "accessLogging", label: "Access logging" },
    ],
  },
  "aws-api-gateway": {
    fields: [
      { kind: "select", key: "apiProtocol", label: "API protocol", options: [{ label: "REST", value: "rest" }, { label: "HTTP", value: "http" }, { label: "WebSocket", value: "websocket" }] },
      { kind: "select", key: "endpointType", label: "Endpoint type", options: [{ label: "Regional", value: "regional" }, { label: "Edge optimized", value: "edge" }, { label: "Private", value: "private" }] },
      { kind: "select", key: "apiAuthorization", label: "Authorization", options: [{ label: "None", value: "none" }, { label: "IAM", value: "iam" }, { label: "Cognito", value: "cognito" }, { label: "Lambda authorizer", value: "lambda" }] },
      { kind: "select", key: "apiStage", label: "Deployment stage", options: [{ label: "Development", value: "development" }, { label: "Staging", value: "staging" }, { label: "Production", value: "production" }] },
      { kind: "toggle", key: "apiThrottling", label: "Throttling" },
      { kind: "toggle", key: "accessLogging", label: "Access logging" },
      { kind: "select", key: "firewallMode", label: "Web access control", options: [{ label: "Allow configured flows", value: "allow" }, { label: "Deny flows", value: "deny" }] },
    ],
  },
  "aws-auto-scaling": {
    fields: [
      { kind: "number", key: "desiredCapacity", label: "Desired instances", min: 0 },
      { kind: "toggle", key: "multiAz", label: "Spread across AZs" },
      { kind: "toggle", key: "alarmEnabled", label: "Scaling alarms" },
    ],
  },
  "aws-cloudfront": {
    fields: [
      { kind: "toggle", key: "publicAccess", label: "Public distribution" },
      { kind: "number", key: "cacheTtlSeconds", label: "Cache TTL seconds", min: 0 },
      { kind: "toggle", key: "accessLogging", label: "Standard logs" },
    ],
  },
  "aws-dynamodb": {
    fields: [
      { kind: "select", key: "dynamoCapacityMode", label: "Capacity mode", options: [{ label: "On-demand", value: "on-demand" }, { label: "Provisioned", value: "provisioned" }] },
      { kind: "select", key: "dynamoPartitionKey", label: "Partition key pattern", options: [{ label: "Single-entity key", value: "single-entity" }, { label: "Composite access pattern", value: "composite" }, { label: "Tenant-scoped key", value: "tenant-scoped" }] },
      { kind: "toggle", key: "encryptionAtRest", label: "Encryption at rest" },
      { kind: "toggle", key: "pointInTimeRecovery", label: "Point-in-time recovery" },
      { kind: "toggle", key: "streamEnabled", label: "Streams enabled" },
      { kind: "toggle", key: "globalTables", label: "Global tables" },
    ],
  },
  "aws-ec2": {
    fields: [
      { kind: "number", key: "desiredCapacity", label: "Instances", min: 0 },
      { kind: "select", key: "ec2OperatingSystem", label: "Operating system", options: [{ label: "Linux", value: "linux" }, { label: "Windows", value: "windows" }] },
      { kind: "select", key: "ec2Ami", label: "AMI", options: [{ label: "Amazon Linux 2023", value: "amazon-linux-2023" }, { label: "Ubuntu 24.04 LTS", value: "ubuntu-24-04" }, { label: "Windows Server 2025", value: "windows-2025" }, { label: "Custom AMI", value: "custom" }] },
      { kind: "select", key: "ec2InstanceType", label: "Instance type", options: [{ label: "t3.micro", value: "t3.micro" }, { label: "t3.small", value: "t3.small" }, { label: "t3.medium", value: "t3.medium" }, { label: "m7g.medium (Graviton)", value: "m7g.medium" }, { label: "m7i.large", value: "m7i.large" }] },
      { kind: "select", key: "ec2Architecture", label: "CPU architecture", options: [{ label: "x86_64", value: "x86_64" }, { label: "arm64 / Graviton", value: "arm64" }] },
      { kind: "number", key: "ec2RootVolumeGb", label: "Root volume GB", min: 8, max: 16384 },
      { kind: "select", key: "ec2RootVolumeType", label: "Root EBS type", options: [{ label: "gp3 General Purpose SSD", value: "gp3" }, { label: "io2 Provisioned IOPS SSD", value: "io2" }] },
      { kind: "number", key: "ec2DataVolumeCount", label: "Data EBS volumes", min: 0, max: 28 },
      { kind: "select", key: "ec2DataVolumeType", label: "Data EBS type", options: [{ label: "gp3 General Purpose SSD", value: "gp3" }, { label: "io2 Provisioned IOPS SSD", value: "io2" }, { label: "st1 Throughput HDD", value: "st1" }, { label: "sc1 Cold HDD", value: "sc1" }] },
      { kind: "number", key: "ec2DataVolumeGb", label: "Data volume size GB", min: 1, max: 16384 },
      { kind: "number", key: "ec2DataVolumeIops", label: "Data volume IOPS", min: 100, max: 256000 },
      { kind: "toggle", key: "ec2InstanceStore", label: "Instance store (ephemeral)" },
      { kind: "toggle", key: "ec2SnapshotEnabled", label: "EBS snapshots enabled" },
      { kind: "select", key: "ec2SnapshotFrequency", label: "Snapshot frequency", options: [{ label: "Hourly", value: "hourly" }, { label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }] },
      { kind: "number", key: "ec2SnapshotRetentionDays", label: "Snapshot retention days", min: 1, max: 3650 },
      { kind: "toggle", key: "publicAccess", label: "Public IP" },
      { kind: "toggle", key: "encryptionAtRest", label: "Encrypted EBS" },
      { kind: "text", key: "iamRoleName", label: "Instance profile role", placeholder: "Ec2AppInstanceRole" },
      { kind: "toggle", key: "alarmEnabled", label: "CloudWatch alarms" },
    ],
  },
  "aws-iam": {
    fields: [
      { kind: "text", key: "iamRoleName", label: "Role name", placeholder: "NimbusArcAppRole" },
      { kind: "text", key: "iamRoleTrustedService", label: "Trusted principal", placeholder: "ec2.amazonaws.com" },
      { kind: "toggle", key: "leastPrivilege", label: "Least-privilege policy" },
      { kind: "toggle", key: "keyRotation", label: "Access key rotation" },
      { kind: "select", key: "scpMode", label: "Organization SCP", options: [{ label: "Allow", value: "allow" }, { label: "Explicit deny", value: "deny" }] },
    ],
  },
  "aws-kms": {
    fields: [
      { kind: "toggle", key: "keyRotation", label: "Key rotation" },
      { kind: "toggle", key: "leastPrivilege", label: "Scoped key policy" },
    ],
  },
  "aws-lambda": {
    fields: [
      { kind: "select", key: "lambdaRuntime", label: "Runtime", options: [{ label: "Node.js 22.x", value: "nodejs22.x" }, { label: "Python 3.13", value: "python3.13" }, { label: "Java 21", value: "java21" }, { label: ".NET 8", value: "dotnet8" }, { label: "Custom runtime", value: "provided.al2023" }] },
      { kind: "select", key: "lambdaArchitecture", label: "Architecture", options: [{ label: "x86_64", value: "x86_64" }, { label: "arm64 / Graviton", value: "arm64" }] },
      { kind: "number", key: "lambdaMemoryMb", label: "Memory MB", min: 128, max: 10240, step: 1 },
      { kind: "number", key: "lambdaTimeoutSeconds", label: "Timeout seconds", min: 1, max: 900 },
      { kind: "number", key: "lambdaEphemeralStorageMb", label: "Ephemeral storage MB", min: 512, max: 10240 },
      { kind: "number", key: "desiredCapacity", label: "Reserved concurrency", min: 0 },
      { kind: "toggle", key: "publicAccess", label: "Public invoke path" },
      { kind: "toggle", key: "deadLetterQueue", label: "Failure destination / DLQ" },
      { kind: "text", key: "iamRoleName", label: "Execution role", placeholder: "LambdaExecutionRole" },
      { kind: "toggle", key: "alarmEnabled", label: "Error alarms" },
    ],
  },
  "aws-nat-gateway": {
    fields: [
      { kind: "toggle", key: "multiAz", label: "One NAT per AZ" },
      { kind: "toggle", key: "highAvailability", label: "Resilient egress" },
    ],
  },
  "aws-rds": {
    fields: [
      { kind: "select", key: "rdsEngine", label: "Database engine", options: [{ label: "PostgreSQL", value: "postgres" }, { label: "MySQL", value: "mysql" }, { label: "MariaDB", value: "mariadb" }, { label: "Oracle Enterprise", value: "oracle-ee" }, { label: "SQL Server Enterprise", value: "sqlserver-ee" }] },
      { kind: "select", key: "rdsInstanceClass", label: "DB instance class", options: [{ label: "db.t4g.micro", value: "db.t4g.micro" }, { label: "db.t4g.small", value: "db.t4g.small" }, { label: "db.r6g.large", value: "db.r6g.large" }, { label: "db.r6g.xlarge", value: "db.r6g.xlarge" }] },
      { kind: "select", key: "rdsStorageType", label: "Storage type", options: [{ label: "General purpose SSD gp3", value: "gp3" }, { label: "Provisioned IOPS io2", value: "io2" }, { label: "Magnetic", value: "magnetic" }] },
      { kind: "number", key: "rdsStorageGb", label: "Allocated storage GB", min: 20, max: 65536 },
      { kind: "toggle", key: "encryptionAtRest", label: "Encryption at rest" },
      { kind: "toggle", key: "multiAz", label: "Multi-AZ standby" },
      { kind: "number", key: "readReplicas", label: "Read replicas", min: 0, max: 15 },
      { kind: "toggle", key: "deletionProtection", label: "Deletion protection" },
    ],
  },
  "aws-s3": {
    fields: [
      { kind: "select", key: "s3StorageClass", label: "Default storage class", options: [{ label: "S3 Standard", value: "standard" }, { label: "Intelligent-Tiering", value: "intelligent-tiering" }, { label: "Standard-IA", value: "standard-ia" }, { label: "One Zone-IA", value: "one-zone-ia" }, { label: "Glacier Instant Retrieval", value: "glacier-instant" }] },
      { kind: "toggle", key: "publicAccess", label: "Public bucket access" },
      { kind: "toggle", key: "encryptionAtRest", label: "Default encryption" },
      { kind: "toggle", key: "versioning", label: "Versioning" },
      { kind: "toggle", key: "lifecycleRules", label: "Lifecycle rules" },
      { kind: "select", key: "iamPolicyMode", label: "Bucket policy", options: [{ label: "Least privilege", value: "least-privilege" }, { label: "Broad permissions", value: "broad" }, { label: "No permissions", value: "none" }] },
    ],
  },
  "aws-secrets-manager": {
    fields: [
      { kind: "toggle", key: "secretRotation", label: "Automatic rotation" },
      { kind: "toggle", key: "encryptionAtRest", label: "KMS encryption" },
      { kind: "toggle", key: "leastPrivilege", label: "Scoped access" },
    ],
  },
  "aws-sqs": {
    fields: [
      { kind: "select", key: "queueType", label: "Queue type", options: [{ label: "Standard", value: "standard" }, { label: "FIFO", value: "fifo" }] },
      { kind: "number", key: "sqsVisibilityTimeoutSeconds", label: "Visibility timeout seconds", min: 0, max: 43200 },
      { kind: "number", key: "sqsMessageRetentionHours", label: "Message retention hours", min: 1, max: 336 },
      { kind: "toggle", key: "deadLetterQueue", label: "Dead-letter queue" },
      { kind: "toggle", key: "encryptionAtRest", label: "SSE encryption" },
      { kind: "toggle", key: "alarmEnabled", label: "Queue depth alarms" },
    ],
  },
  "aws-vpn-gateway": {
    fields: [
      { kind: "number", key: "vpnTunnels", label: "VPN tunnels", min: 0, max: 4 },
      { kind: "toggle", key: "highAvailability", label: "Redundant tunnels" },
    ],
  },
  "aws-waf": {
    title: "Web Application Firewall",
    description: "Attach WAF to CloudFront, ALB, or API Gateway and model HTTP filtering behavior.",
    fields: [
      { kind: "toggle", key: "enableManagedRules", label: "Managed rule groups" },
      { kind: "toggle", key: "enableRateLimit", label: "Rate-based rule" },
      { kind: "toggle", key: "accessLogging", label: "Sampled requests / logging" },
    ],
  },
};

function getServiceTemplate(service?: CloudService, node?: ArchitectureNode): ServiceInspectorTemplate {
  const baseTemplate = baseServiceTemplates[service?.category ?? ""] ?? {
    title: "AWS service",
    description: "Configure the service settings that matter for this architecture decision.",
    fields: [
      { kind: "toggle", key: "highAvailability", label: "High availability" },
      { kind: "toggle", key: "encryptionAtRest", label: "Encryption at rest" },
    ],
  };
  const serviceTemplate = serviceTemplates[node?.serviceId ?? ""];

  return {
    ...baseTemplate,
    ...serviceTemplate,
    fields: serviceTemplate?.fields ?? baseTemplate.fields,
  };
}

function isValidIpv4Cidr(value: string) {
  const match = value.match(/^(\d{1,3}\.){3}\d{1,3}\/(\d|[12]\d|3[0-2])$/);
  if (!match) return false;
  const [ip] = value.split("/");
  return ip.split(".").every((segment) => {
    const parsed = Number(segment);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255;
  });
}

function isValidIpv6Cidr(value: string) {
  const [ip, prefix] = value.split("/");
  if (!ip || !prefix) return false;
  const parsedPrefix = Number(prefix);
  if (!Number.isInteger(parsedPrefix) || parsedPrefix < 0 || parsedPrefix > 128) return false;
  return ip.includes(":");
}

function getAllowedConnectionLabels(service: CloudService, servicesById?: Map<string, CloudService>) {
  if (service.allowedConnections.length === 0) {
    return ["No explicit connections modeled yet for this service."];
  }

  return service.allowedConnections.map((serviceId) => {
    const label = servicesById?.get(serviceId)?.name ?? formatServiceId(serviceId);
    const note = service.learningProfile?.connectionNotes?.[serviceId];
    return note ? `${label}: ${note}` : label;
  });
}

function formatServiceId(serviceId: string) {
  return serviceId
    .replace(/^aws-/, "")
    .split("-")
    .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAdvancedConfiguration(service: CloudService): string[] {
  const categoryGuidance: Record<string, string> = {
    Actors: "Keep the actor outside AWS trust boundaries and model the request origin explicitly.",
    Networking: "Validate route tables, CIDR overlap, ingress and egress paths, and Availability Zone placement.",
    Edge: "Review cache behavior, origin failover, TLS policy, invalidation, and regional coverage.",
    Compute: "Review runtime limits, health checks, scaling signals, deployment strategy, and failure recovery.",
    Storage: "Review lifecycle transitions, data protection, access policies, replication, and recovery objectives.",
    Database: "Review capacity mode, backup and restore behavior, failover, replicas, indexes, and quotas.",
    "Application Integration": "Review retry behavior, idempotency, delivery guarantees, ordering, throttling, and dead-letter handling.",
    Analytics: "Review retention, partitioning, throughput, replay behavior, encryption, and downstream failure handling.",
    Security: "Review policy scope, auditability, rotation, service integration, and least-privilege boundaries.",
    Operations: "Review retention, alert thresholds, cross-account collection, dashboards, and incident response paths.",
  };

  return [
    categoryGuidance[service.category] ?? "Review service quotas, regional availability, IAM permissions, and failure behavior.",
    "Confirm current quotas, pricing, and regional feature availability in the official documentation.",
  ];
}

export function ArchitectureInspector({
  edge,
  node,
  zone,
  service,
  servicesById,
  onClose,
  onUpdateEdge,
  onUpdateNodeConfig,
  onUpdateNodeLabel,
  onUpdateZone,
}: ArchitectureInspectorProps) {
  const [zoneErrors, setZoneErrors] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [panelWidth, setPanelWidth] = useState(390);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | undefined>(undefined);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      setPanelWidth(Math.max(300, Math.min(820, resizeState.startWidth - (event.clientX - resizeState.startX))));
    };
    const handlePointerUp = () => {
      resizeStateRef.current = undefined;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const closeAction = onClose ? (
    <button
      aria-label="Close inspector"
      className="panel__close"
      onClick={onClose}
      type="button"
    >
      <X aria-hidden="true" size={15} />
    </button>
  ) : undefined;
  const inspectorActions = (
    <div className="panel__actions-group">
      <button aria-label={isExpanded ? "Restore inspector size" : "Expand inspector over canvas"} className="panel__icon-button" onClick={() => setIsExpanded((expanded) => !expanded)} title={isExpanded ? "Restore inspector size" : "Expand inspector over canvas"} type="button">
        {isExpanded ? <Minimize2 aria-hidden="true" size={15} /> : <Maximize2 aria-hidden="true" size={15} />}
      </button>
      <button aria-label="Collapse inspector" className="panel__icon-button" onClick={() => setIsCollapsed(true)} title="Collapse inspector" type="button">
        <PanelRightClose aria-hidden="true" size={15} />
      </button>
      {closeAction}
    </div>
  );
  const panelClassName = `inspector-panel ${isExpanded ? "inspector-panel--expanded" : ""}`.trim();
  const panelStyle = { "--inspector-width": `${panelWidth}px` } as CSSProperties;
  const resizeHandle = (
    <button
      aria-label="Resize inspector"
      className="inspector-resize-handle"
      onPointerDown={(event) => {
        resizeStateRef.current = { startX: event.clientX, startWidth: panelWidth };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      title="Drag to resize inspector"
      type="button"
    />
  );

  if (isCollapsed) {
    return (
      <div className="inspector-collapsed">
        <button aria-label="Expand inspector" className="inspector-collapsed__button" onClick={() => setIsCollapsed(false)} title="Expand inspector" type="button">
          <PanelRightOpen aria-hidden="true" size={16} />
        </button>
        <span>Inspector</span>
      </div>
    );
  }

  if (node) {
    const template = getServiceTemplate(service, node);

    return (
      <Panel className={panelClassName} style={panelStyle} actions={inspectorActions} title="Inspector" eyebrow="Selected service">
        {resizeHandle}
        <div className="inspector">
          <div className="inspector__identity">
            <AwsServiceIcon label={node.label} serviceId={node.serviceId} size="md" />
            <div>
              <strong>{service?.name ?? node.label}</strong>
              <small>{service?.category ?? "AWS service"}</small>
            </div>
          </div>
          <label className="inspector__field">
            <span>Display name</span>
            <input
              defaultValue={node.label}
              key={node.id}
              onBlur={(event) => onUpdateNodeLabel(event.target.value)}
            />
          </label>
          <div className="inspector__service-template">
            <strong>{template.title}</strong>
            <p>{template.description}</p>
          </div>
          {service ? (
            <section className="inspector__learning">
              <LearningAccordion items={service.learningProfile?.summary ?? [service.shortDescription]} open title="Summary" />
              <LearningAccordion
                items={service.learningProfile?.features ?? (service.examSignals.length > 0 ? service.examSignals : ["Review the primary capabilities this service is meant to provide in AWS architectures."])}
                title="Features"
              />
              <LearningAccordion
                items={service.learningProfile?.useCases ?? (service.commonUseCases.length > 0 ? service.commonUseCases : ["Use this service where its managed behavior clearly reduces operational overhead or improves architecture fit."])}
                title="Use cases"
              />
              <LearningAccordion
                items={service.learningProfile?.limitations ?? (service.commonTraps.length > 0 ? service.commonTraps : ["Review service limits, tradeoffs, and anti-patterns before placing it in the design."])}
                title="Limitations"
              />
              <LearningAccordion
                items={service.learningProfile?.configuration ?? (service.configurationGuidance?.length ? service.configurationGuidance : ["Review placement, connectivity, security, and scaling choices for this service."])}
                title="Configuration"
              />
              <LearningAccordion
                items={getAllowedConnectionLabels(service, servicesById)}
                title="Allowed connections"
              />
              <LearningAccordion
                items={service.learningProfile?.advancedConfiguration ?? getAdvancedConfiguration(service)}
                title="Advanced configuration"
              />
              <a className="inspector__docs-link" href={service.docsUrl} rel="noreferrer" target="_blank">
                Official AWS documentation
                <ExternalLink aria-hidden="true" size={14} />
              </a>
            </section>
          ) : null}
          <div className="inspector__toggles">
            {template.fields.map((field) => (
              <ConfigField
                config={node.config}
                field={field}
                key={`${node.id}-${String(field.key)}`}
                onChange={(changes) => onUpdateNodeConfig({ ...node.config, ...changes })}
              />
            ))}
          </div>
          <details className="inspector__section" open>
            <summary>IAM, organizations, and tags</summary>
            <div className="inspector__section-body">
              <label className="inspector__field">
                <span>IAM role name</span>
                <input
                  defaultValue={node.config.iamRoleName ?? ""}
                  key={`${node.id}-role`}
                  onBlur={(event) => onUpdateNodeConfig({ ...node.config, iamRoleName: event.target.value || undefined })}
                  placeholder="NimbusArcExecutionRole"
                />
              </label>
              <label className="inspector__field">
                <span>Trusted service principal</span>
                <input
                  defaultValue={node.config.iamRoleTrustedService ?? ""}
                  key={`${node.id}-principal`}
                  onBlur={(event) => onUpdateNodeConfig({ ...node.config, iamRoleTrustedService: event.target.value || undefined })}
                  placeholder="lambda.amazonaws.com"
                />
              </label>
              <label className="inspector__field">
                <span>Organization unit</span>
                <input
                  defaultValue={node.config.organizationUnit ?? ""}
                  key={`${node.id}-ou`}
                  onBlur={(event) => onUpdateNodeConfig({ ...node.config, organizationUnit: event.target.value || undefined })}
                  placeholder="ou-prod-apps"
                />
              </label>
              <label className="inspector__field">
                <span>Account ID</span>
                <input
                  defaultValue={node.config.organizationAccountId ?? ""}
                  key={`${node.id}-account`}
                  onBlur={(event) => onUpdateNodeConfig({ ...node.config, organizationAccountId: event.target.value || undefined })}
                  placeholder="123456789012"
                />
              </label>
              <label className="inspector__field">
                <span>SCP mode</span>
                <select
                  value={node.config.scpMode ?? "allow"}
                  onChange={(event) => onUpdateNodeConfig({ ...node.config, scpMode: event.target.value as "allow" | "deny" })}
                >
                  <option value="allow">Allow</option>
                  <option value="deny">Explicit deny</option>
                </select>
              </label>
              <label className="inspector__field">
                <span>Resource tags</span>
                <textarea
                  defaultValue={node.config.tagsText ?? ""}
                  key={`${node.id}-tags`}
                  onBlur={(event) => onUpdateNodeConfig({ ...node.config, tagsText: event.target.value || undefined })}
                  placeholder="env=prod&#10;owner=platform&#10;cost-center=learning"
                  rows={4}
                />
              </label>
            </div>
          </details>
          {service?.databaseInspection ? (
            <DatabaseInspectionPreview service={service} />
          ) : null}
          <p className="inspector__hint">Configuration will feed architecture validation and IaC generation in later phases.</p>
        </div>
      </Panel>
    );
  }

  if (zone) {
    return (
      <Panel className={panelClassName} style={panelStyle} actions={inspectorActions} title="Inspector" eyebrow="Selected architecture scope">
        {resizeHandle}
        <div className="inspector">
          <div className="inspector__identity">
            <div className={`zone-inspector__swatch zone-inspector__swatch--${zone.kind}`} />
            <div>
              <strong>{zone.label}</strong>
              <small>{zone.kind.replaceAll("-", " ")}</small>
            </div>
          </div>
          <label className="inspector__field">
            <span>Display name</span>
            <input defaultValue={zone.label} key={zone.id} onBlur={(event) => onUpdateZone({ label: event.target.value })} />
          </label>
          <label className="inspector__field">
            <span>Description</span>
            <input defaultValue={zone.description ?? ""} key={`${zone.id}-description`} onBlur={(event) => onUpdateZone({ description: event.target.value })} />
          </label>
          {zone.kind === "region" ? (
            <>
              <label className="inspector__field"><span>Region code</span><input defaultValue={zone.config?.regionCode ?? ""} onBlur={(event) => onUpdateZone({ config: { ...zone.config, regionCode: event.target.value } })} placeholder="us-east-1" /></label>
              <label className="inspector__field">
                <span>IP address family</span>
                <select
                  value={zone.config?.ipAddressFamily ?? "dualstack"}
                  onChange={(event) => onUpdateZone({ config: { ...zone.config, ipAddressFamily: event.target.value as "ipv4" | "ipv6" | "dualstack" } })}
                >
                  <option value="ipv4">IPv4</option>
                  <option value="ipv6">IPv6</option>
                  <option value="dualstack">Dual stack</option>
                </select>
              </label>
            </>
          ) : null}
          {zone.kind === "availability-zone" || zone.kind === "subnet" ? (
            <label className="inspector__field">
              <span>Availability Zone</span>
              <select
                value={zone.config?.availabilityZoneName ?? ""}
                onChange={(event) => onUpdateZone({ config: { ...zone.config, availabilityZoneName: event.target.value || undefined } })}
              >
                <option value="">Not assigned</option>
                {awsAvailabilityZones.map((az) => (
                  <option key={az} value={az}>{az}</option>
                ))}
              </select>
            </label>
          ) : null}
          {zone.kind === "vpc" || zone.kind === "subnet" ? (
            <>
              <label className="inspector__field">
                <span>IP address family</span>
                <select
                  value={zone.config?.ipAddressFamily ?? "dualstack"}
                  onChange={(event) => onUpdateZone({ config: { ...zone.config, ipAddressFamily: event.target.value as "ipv4" | "ipv6" | "dualstack" } })}
                >
                  <option value="ipv4">IPv4</option>
                  <option value="ipv6">IPv6</option>
                  <option value="dualstack">Dual stack</option>
                </select>
              </label>
              {(zone.config?.ipAddressFamily ?? "dualstack") !== "ipv6" ? (
                <label className="inspector__field">
                  <span>IPv4 CIDR</span>
                  <input
                    defaultValue={zone.config?.cidrIpv4 ?? zone.config?.cidrBlock ?? ""}
                    key={`${zone.id}-cidr4`}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && !isValidIpv4Cidr(value)) {
                        setZoneErrors((current) => ({ ...current, [`${zone.id}-cidr4`]: "Use a valid IPv4 CIDR such as 10.0.0.0/16." }));
                        return;
                      }
                      setZoneErrors((current) => ({ ...current, [`${zone.id}-cidr4`]: "" }));
                      onUpdateZone({ config: { ...zone.config, cidrIpv4: value || undefined, cidrBlock: value || undefined } });
                    }}
                    placeholder="10.0.0.0/16"
                  />
                </label>
              ) : null}
              {zoneErrors[`${zone.id}-cidr4`] ? <p className="inspector__error">{zoneErrors[`${zone.id}-cidr4`]}</p> : null}
              {(zone.config?.ipAddressFamily ?? "dualstack") !== "ipv4" ? (
                <label className="inspector__field">
                  <span>IPv6 CIDR</span>
                  <input
                    defaultValue={zone.config?.cidrIpv6 ?? ""}
                    key={`${zone.id}-cidr6`}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && !isValidIpv6Cidr(value)) {
                        setZoneErrors((current) => ({ ...current, [`${zone.id}-cidr6`]: "Use a valid IPv6 CIDR such as 2001:db8::/56." }));
                        return;
                      }
                      setZoneErrors((current) => ({ ...current, [`${zone.id}-cidr6`]: "" }));
                      onUpdateZone({ config: { ...zone.config, cidrIpv6: value || undefined } });
                    }}
                    placeholder="2001:db8::/56"
                  />
                </label>
              ) : null}
              {zoneErrors[`${zone.id}-cidr6`] ? <p className="inspector__error">{zoneErrors[`${zone.id}-cidr6`]}</p> : null}
            </>
          ) : null}
          {zone.kind === "subnet" ? (
            <label className="inspector__field"><span>Subnet access</span><select defaultValue={zone.config?.subnetAccess ?? "private"} onChange={(event) => onUpdateZone({ config: { ...zone.config, subnetAccess: event.target.value as "public" | "private" } })}><option value="public">Public</option><option value="private">Private</option></select></label>
          ) : null}
          {zone.kind === "vpc" || zone.kind === "subnet" ? (
            <details className="inspector__section" open>
              <summary>DNS, route tables, and network layer</summary>
              <div className="inspector__section-body">
                <Toggle
                  checked={zone.config?.dnsResolution ?? true}
                  label="DNS resolution"
                  onChange={(checked) => onUpdateZone({ config: { ...zone.config, dnsResolution: checked } })}
                />
                <Toggle
                  checked={zone.config?.dnsHostnames ?? true}
                  label="DNS hostnames"
                  onChange={(checked) => onUpdateZone({ config: { ...zone.config, dnsHostnames: checked } })}
                />
                <label className="inspector__field">
                  <span>Route table name</span>
                  <input
                    defaultValue={zone.config?.routeTableName ?? ""}
                    key={`${zone.id}-route-table`}
                    onBlur={(event) => onUpdateZone({ config: { ...zone.config, routeTableName: event.target.value || undefined } })}
                    placeholder="public-a"
                  />
                </label>
                <label className="inspector__field">
                  <span>Default route target</span>
                  <select
                    value={zone.config?.routeTarget ?? "local-only"}
                    onChange={(event) => onUpdateZone({ config: { ...zone.config, routeTarget: event.target.value as typeof routeTargets[number]["value"] } })}
                  >
                    {routeTargets.map((target) => (
                      <option key={target.value} value={target.value}>{target.label}</option>
                    ))}
                  </select>
                </label>
                <Toggle
                  checked={zone.config?.routePropagation ?? false}
                  label="Route propagation enabled"
                  onChange={(checked) => onUpdateZone({ config: { ...zone.config, routePropagation: checked } })}
                />
                <label className="inspector__field">
                  <span>Network ACL</span>
                  <select
                    value={zone.config?.networkAclMode ?? "allow"}
                    onChange={(event) => onUpdateZone({ config: { ...zone.config, networkAclMode: event.target.value as "allow" | "deny" } })}
                  >
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                </label>
              </div>
            </details>
          ) : null}
          <p className="inspector__hint">Services assigned to this scope are shown inside it. Parent zones define the AWS containment hierarchy.</p>
        </div>
      </Panel>
    );
  }

  if (edge) {
    const controls = {
      routeAllowed: edge.controls?.routeAllowed ?? true,
      securityGroupAllowed: edge.controls?.securityGroupAllowed ?? true,
      networkAclAllowed: edge.controls?.networkAclAllowed ?? true,
      dnsRequired: edge.controls?.dnsRequired ?? false,
      dnsAllowed: edge.controls?.dnsAllowed ?? true,
      iamRequired: edge.controls?.iamRequired ?? false,
      iamAllowed: edge.controls?.iamAllowed ?? true,
      scpAllowed: edge.controls?.scpAllowed ?? true,
    };

    return (
      <Panel className={panelClassName} style={panelStyle} actions={inspectorActions} title="Inspector" eyebrow="Selected connection">
        {resizeHandle}
        <div className="inspector">
          <label className="inspector__field">
            <span>Flow label</span>
            <input
              defaultValue={edge.label ?? ""}
              key={edge.id}
              onBlur={(event) => onUpdateEdge({ label: event.target.value.trim() || undefined })}
              placeholder="HTTPS, SQL, logs..."
            />
          </label>
          <label className="inspector__field">
            <span>Flow type</span>
            <select
              defaultValue={edge.kind}
              key={`${edge.id}-kind`}
              onChange={(event) => onUpdateEdge({ kind: event.target.value as ArchitectureEdgeKind })}
            >
              {edgeKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </label>
          <fieldset className="inspector__direction">
            <legend>Direction</legend>
            <label><input checked={edge.direction !== "two-way"} name="direction" onChange={() => onUpdateEdge({ direction: "one-way" })} type="radio" /> One way</label>
            <label><input checked={edge.direction === "two-way"} name="direction" onChange={() => onUpdateEdge({ direction: "two-way" })} type="radio" /> Two way</label>
          </fieldset>
          <fieldset className="inspector__direction">
            <legend>Flow controls</legend>
            <Toggle
              checked={controls.routeAllowed}
              label="Route allowed"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, routeAllowed: checked } })}
            />
            <Toggle
              checked={controls.securityGroupAllowed}
              label="Security group allowed"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, securityGroupAllowed: checked } })}
            />
            <Toggle
              checked={controls.networkAclAllowed}
              label="NACL allowed"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, networkAclAllowed: checked } })}
            />
            <Toggle
              checked={controls.dnsRequired}
              label="DNS required"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, dnsRequired: checked } })}
            />
            <Toggle
              checked={controls.dnsAllowed}
              label="DNS allowed"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, dnsAllowed: checked } })}
            />
            <Toggle
              checked={controls.iamRequired}
              label="IAM authorization required"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, iamRequired: checked } })}
            />
            <Toggle
              checked={controls.iamAllowed}
              label="IAM allowed"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, iamAllowed: checked } })}
            />
            <Toggle
              checked={controls.scpAllowed}
              label="SCP allowed"
              onChange={(checked) => onUpdateEdge({ controls: { ...controls, scpAllowed: checked } })}
            />
          </fieldset>
          <p className="inspector__hint">Run the architecture to see allowed flows glow green and blocked paths turn red.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={panelClassName} style={panelStyle} actions={inspectorActions} title="Inspector" eyebrow="Architecture canvas">
      {resizeHandle}
      <p className="inspector__empty">Select a service or connection to inspect and configure it.</p>
    </Panel>
  );
}

function LearningAccordion({ items, title, open = false }: { items: string[]; title: string; open?: boolean }) {
  return (
    <details className="inspector__section" open={open}>
      <summary>{title}</summary>
      <div className="inspector__section-body">
        <ul className="inspector__list">
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="inspector__toggle">
      <span>{label}</span>
      <input checked={checked} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function ConfigField({
  config,
  field,
  onChange,
}: {
  config: ArchitectureNodeConfig;
  field: InspectorField;
  onChange: (changes: Partial<ArchitectureNodeConfig>) => void;
}) {
  if (field.kind === "toggle") {
    return (
      <Toggle
        checked={Boolean(config[field.key])}
        label={field.label}
        onChange={(checked) => onChange({ [field.key]: checked })}
      />
    );
  }

  if (field.kind === "select") {
    return (
      <label className="inspector__field">
        <span>{field.label}</span>
        <select
          value={(config[field.key] as string | undefined) ?? ""}
          onChange={(event) => onChange({ [field.key]: event.target.value || undefined })}
        >
          <option value="">Not set</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === "text") {
    return (
      <label className="inspector__field">
        <span>{field.label}</span>
        <input
          onChange={(event) => onChange({ [field.key]: event.target.value || undefined })}
          placeholder={field.placeholder}
          type="text"
          value={(config[field.key] as string | undefined) ?? ""}
        />
      </label>
    );
  }

  return (
    <label className="inspector__field">
      <span>{field.label}</span>
      <input
        max={field.max}
        min={field.min}
        onChange={(event) => onChange({ [field.key]: Number(event.target.value) || undefined })}
        step={field.step}
        type="number"
        value={(config[field.key] as number | undefined) ?? ""}
      />
    </label>
  );
}

function DatabaseInspectionPreview({ service }: { service: CloudService }) {
  const inspection = service.databaseInspection;

  if (!inspection) {
    return null;
  }

  return (
    <section className="inspector__database-preview">
      <div className="inspector__service-template">
        <strong>Data internals</strong>
        <p>{inspection.engine}</p>
      </div>
      {inspection.kind === "relational" ? inspection.tables.map((table) => (
        <RelationalPreview key={table.name} table={table} />
      )) : null}
      {inspection.kind === "document" ? inspection.collections.map((collection) => (
        <DocumentPreview collection={collection} key={collection.name} />
      )) : null}
      {inspection.kind === "cache" ? (
        <CachePreview entries={inspection.entries} />
      ) : null}
    </section>
  );
}

function RelationalPreview({ table }: { table: RelationalTablePreview }) {
  return (
    <section className="database-card">
      <div className="database-card__header">
        <strong>{table.name}</strong>
        <small>table</small>
      </div>
      <div className="database-grid database-grid--table">
        <div className="database-grid__row database-grid__row--head">
          {table.columns.map((column) => (
            <span key={`${table.name}-${column}`}>{column}</span>
          ))}
        </div>
        {table.rows.map((row, index) => (
          <div className="database-grid__row" key={`${table.name}-row-${index}`}>
            {row.map((value, valueIndex) => (
              <span key={`${table.name}-${index}-${valueIndex}`}>{value}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentPreview({ collection }: { collection: DocumentCollectionPreview }) {
  return (
    <section className="database-card">
      <div className="database-card__header">
        <strong>{collection.name}</strong>
        <small>{collection.partitionKey}{collection.sortKey ? ` + ${collection.sortKey}` : ""}</small>
      </div>
      <div className="database-documents">
        {collection.documents.map((document, index) => (
          <pre className="database-document" key={`${collection.name}-${index}`}>{JSON.stringify(document, null, 2)}</pre>
        ))}
      </div>
    </section>
  );
}

function CachePreview({ entries }: { entries: CacheEntryPreview[] }) {
  return (
    <section className="database-card">
      <div className="database-card__header">
        <strong>keys</strong>
        <small>hot data</small>
      </div>
      <div className="database-cache">
        {entries.map((entry) => (
          <div className="database-cache__row" key={entry.key}>
            <div>
              <strong>{entry.key}</strong>
              <p>{entry.value}</p>
            </div>
            {entry.ttl ? <small>{entry.ttl}</small> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
