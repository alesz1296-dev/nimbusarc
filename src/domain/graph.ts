import type { CloudProvider, Scenario } from "./types";

export type ArchitectureNodeId = string;
export type ArchitectureEdgeId = string;
export type ArchitectureZoneId = string;

export type CanvasPoint = {
  x: number;
  y: number;
};

export type ArchitectureZoneKind =
  | "global"
  | "region"
  | "vpc"
  | "availability-zone"
  | "subnet"
  | "data-tier"
  | "edge";

export type ArchitectureZone = {
  id: ArchitectureZoneId;
  provider: CloudProvider;
  kind: ArchitectureZoneKind;
  label: string;
  layerOrder?: number;
  parentZoneId?: ArchitectureZoneId;
  description?: string;
  layout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config?: {
    regionCode?: string;
    availabilityZoneName?: string;
    cidrBlock?: string;
    cidrIpv4?: string;
    cidrIpv6?: string;
    ipAddressFamily?: "ipv4" | "ipv6" | "dualstack";
    subnetAccess?: "public" | "private";
    dnsResolution?: boolean;
    dnsHostnames?: boolean;
    routeTableName?: string;
    routeTarget?: "local-only" | "internet-gateway" | "nat-gateway" | "egress-only-igw" | "transit-gateway" | "vpn-gateway" | "vpc-endpoint";
    routePropagation?: boolean;
    networkAclMode?: "allow" | "deny";
  };
};

export type ArchitectureNodeConfig = {
  highAvailability?: boolean;
  multiAz?: boolean;
  publicAccess?: boolean;
  encryptionAtRest?: boolean;
  desiredCapacity?: number;
  trafficSharePercent?: number;
  targetGroupCount?: number;
  targetsPerGroup?: number;
  accessLogging?: boolean;
  alarmEnabled?: boolean;
  firewallMode?: "allow" | "deny";
  iamPolicyMode?: "least-privilege" | "broad" | "none";
  ec2Ami?: "amazon-linux-2023" | "ubuntu-24-04" | "windows-2025" | "custom";
  ec2Architecture?: "x86_64" | "arm64";
  ec2DataVolumeCount?: number;
  ec2DataVolumeGb?: number;
  ec2DataVolumeIops?: number;
  ec2DataVolumeType?: "gp3" | "io2" | "st1" | "sc1";
  ec2InstanceType?: "t3.micro" | "t3.small" | "t3.medium" | "m7g.medium" | "m7i.large";
  ec2InstanceStore?: boolean;
  ec2OperatingSystem?: "linux" | "windows";
  ec2RootVolumeGb?: number;
  ec2RootVolumeType?: "gp3" | "io2";
  ec2SnapshotEnabled?: boolean;
  ec2SnapshotFrequency?: "hourly" | "daily" | "weekly";
  ec2SnapshotRetentionDays?: number;
  apiAuthorization?: "none" | "iam" | "cognito" | "lambda";
  apiThrottling?: boolean;
  apiProtocol?: "rest" | "http" | "websocket";
  apiStage?: string;
  cacheTtlSeconds?: number;
  deadLetterQueue?: boolean;
  deletionProtection?: boolean;
  dynamoCapacityMode?: "on-demand" | "provisioned";
  dynamoPartitionKey?: string;
  enableManagedRules?: boolean;
  enableRateLimit?: boolean;
  endpointType?: "public" | "private" | "regional" | "edge";
  globalTables?: boolean;
  keyRotation?: boolean;
  lifecycleRules?: boolean;
  lambdaArchitecture?: "x86_64" | "arm64";
  lambdaEphemeralStorageMb?: number;
  lambdaMemoryMb?: number;
  lambdaRuntime?: "nodejs22.x" | "python3.13" | "java21" | "dotnet8" | "provided.al2023";
  lambdaTimeoutSeconds?: number;
  leastPrivilege?: boolean;
  pointInTimeRecovery?: boolean;
  queueType?: "standard" | "fifo";
  readReplicas?: number;
  rdsEngine?: "postgres" | "mysql" | "mariadb" | "oracle-ee" | "sqlserver-ee";
  rdsInstanceClass?: "db.t4g.micro" | "db.t4g.small" | "db.r6g.large" | "db.r6g.xlarge";
  rdsStorageGb?: number;
  rdsStorageType?: "gp3" | "io2" | "magnetic";
  secretRotation?: boolean;
  streamEnabled?: boolean;
  securityGroupMode?: "allow" | "deny";
  s3StorageClass?: "standard" | "intelligent-tiering" | "standard-ia" | "one-zone-ia" | "glacier-instant";
  scpMode?: "allow" | "deny";
  sqsMessageRetentionHours?: number;
  sqsVisibilityTimeoutSeconds?: number;
  tagsText?: string;
  iamRoleName?: string;
  iamRoleTrustedService?: string;
  organizationUnit?: string;
  organizationAccountId?: string;
  versioning?: boolean;
  vpnTunnels?: number;
};

export type ArchitectureNode = {
  id: ArchitectureNodeId;
  serviceId: string;
  label: string;
  position: CanvasPoint;
  zoneId?: ArchitectureZoneId;
  config: ArchitectureNodeConfig;
};

export type ArchitectureEdgeKind = "request" | "data" | "event" | "observe";

export type ArchitectureEdge = {
  id: ArchitectureEdgeId;
  sourceNodeId: ArchitectureNodeId;
  targetNodeId: ArchitectureNodeId;
  kind: ArchitectureEdgeKind;
  label?: string;
  direction?: "one-way" | "two-way";
  controls?: {
    securityGroupAllowed?: boolean;
    networkAclAllowed?: boolean;
    routeAllowed?: boolean;
    dnsRequired?: boolean;
    dnsAllowed?: boolean;
    iamRequired?: boolean;
    iamAllowed?: boolean;
    scpAllowed?: boolean;
  };
};

export type ArchitectureGraph = {
  provider: CloudProvider;
  scenarioId?: string;
  zones: ArchitectureZone[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};

export type GraphSelection = {
  nodeId?: ArchitectureNodeId;
  nodeIds?: ArchitectureNodeId[];
  edgeId?: ArchitectureEdgeId;
  zoneId?: ArchitectureZoneId;
};

export type ScenarioSubmissionStatus = "idle" | "editing" | "submitted" | "reviewed";

export type FlowSimulationStatus = "idle" | "flowing" | "blocked" | "warming" | "running";

export type EdgeSimulationResult = {
  edgeId: ArchitectureEdgeId;
  status: Extract<FlowSimulationStatus, "flowing" | "blocked">;
  reason?: string;
};

export type NodeSimulationResult = {
  nodeId: ArchitectureNodeId;
  status: FlowSimulationStatus;
  instanceCount?: number;
  reason?: string;
};

export type FlowSimulationSnapshot = {
  status: "idle" | "running" | "completed";
  lastRunAt?: string;
  edges: EdgeSimulationResult[];
  nodes: NodeSimulationResult[];
  summary?: string;
};

export type LearnerScenarioState = {
  scenarioId: Scenario["id"];
  provider: CloudProvider;
  graph: ArchitectureGraph;
  selection: GraphSelection;
  status: ScenarioSubmissionStatus;
  attempts: number;
  lastScore?: number;
  lastSubmittedAt?: string;
  simulation: FlowSimulationSnapshot;
};
