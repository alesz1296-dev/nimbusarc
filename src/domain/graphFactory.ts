import type { Scenario } from "./types";
import type {
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureRouteTable,
  ArchitectureZone,
  LearnerScenarioState,
} from "./graph";
import { createIdleSimulation } from "./flowSimulation";

const awsBaseZones: ArchitectureZone[] = [
  {
    id: "aws-global-edge",
    provider: "aws",
    kind: "edge",
    label: "Internet Edge",
    layerOrder: 1,
    description: "Ingress layer for public-facing services.",
    layout: { x: 2.5, y: 2.5, width: 95, height: 11 },
  },
  {
    id: "aws-region-primary",
    provider: "aws",
    kind: "region",
    label: "AWS Region",
    layerOrder: 2,
    description: "Primary region for the learner architecture.",
    config: {
      regionCode: "us-east-1",
      ipAddressFamily: "dualstack",
      dnsResolution: true,
      dnsHostnames: true,
    },
    layout: { x: 2.5, y: 16, width: 95, height: 81.5 },
  },
  {
    id: "aws-vpc-primary",
    provider: "aws",
    kind: "vpc",
    label: "Application VPC",
    layerOrder: 3,
    parentZoneId: "aws-region-primary",
    config: {
      cidrBlock: "10.0.0.0/16",
      cidrIpv4: "10.0.0.0/16",
      ipAddressFamily: "dualstack",
      dnsResolution: true,
      dnsHostnames: true,
      routeTableName: "main",
      routeTarget: "local-only",
      routePropagation: false,
      networkAclMode: "allow",
    },
    layout: { x: 6, y: 23, width: 88, height: 70 },
  },
  {
    id: "aws-availability-zone-a",
    provider: "aws",
    kind: "availability-zone",
    label: "Availability Zone A",
    layerOrder: 4,
    parentZoneId: "aws-vpc-primary",
    config: {
      availabilityZoneName: "us-east-1a",
      ipAddressFamily: "dualstack",
    },
    layout: { x: 9, y: 31, width: 40, height: 57 },
  },
  {
    id: "aws-availability-zone-b",
    provider: "aws",
    kind: "availability-zone",
    label: "Availability Zone B",
    layerOrder: 5,
    parentZoneId: "aws-vpc-primary",
    config: {
      availabilityZoneName: "us-east-1b",
      ipAddressFamily: "dualstack",
    },
    layout: { x: 51, y: 31, width: 40, height: 57 },
  },
  {
    id: "aws-public-subnet-a",
    provider: "aws",
    kind: "subnet",
    label: "Public Subnet A",
    layerOrder: 6,
    parentZoneId: "aws-vpc-primary",
    config: {
      availabilityZoneName: "us-east-1a",
      cidrBlock: "10.0.1.0/24",
      cidrIpv4: "10.0.1.0/24",
      cidrIpv6: "2001:db8:1:a::/64",
      ipAddressFamily: "dualstack",
      subnetAccess: "public",
      dnsResolution: true,
      dnsHostnames: true,
      routeTableName: "public-a",
      routeTarget: "internet-gateway",
      routePropagation: false,
      networkAclMode: "allow",
    },
    layout: { x: 11.5, y: 39, width: 35, height: 21 },
  },
  {
    id: "aws-public-subnet-b",
    provider: "aws",
    kind: "subnet",
    label: "Public Subnet B",
    layerOrder: 7,
    parentZoneId: "aws-vpc-primary",
    config: {
      availabilityZoneName: "us-east-1b",
      cidrBlock: "10.0.2.0/24",
      cidrIpv4: "10.0.2.0/24",
      cidrIpv6: "2001:db8:1:b::/64",
      ipAddressFamily: "dualstack",
      subnetAccess: "public",
      dnsResolution: true,
      dnsHostnames: true,
      routeTableName: "public-b",
      routeTarget: "internet-gateway",
      routePropagation: false,
      networkAclMode: "allow",
    },
    layout: { x: 53.5, y: 39, width: 35, height: 21 },
  },
  {
    id: "aws-private-subnet-a",
    provider: "aws",
    kind: "subnet",
    label: "Private Subnet A",
    layerOrder: 8,
    parentZoneId: "aws-vpc-primary",
    config: {
      availabilityZoneName: "us-east-1a",
      cidrBlock: "10.0.11.0/24",
      cidrIpv4: "10.0.11.0/24",
      cidrIpv6: "2001:db8:11:a::/64",
      ipAddressFamily: "dualstack",
      subnetAccess: "private",
      dnsResolution: true,
      dnsHostnames: true,
      routeTableName: "private-a",
      routeTarget: "nat-gateway",
      routePropagation: false,
      networkAclMode: "allow",
    },
    layout: { x: 11.5, y: 63, width: 35, height: 21 },
  },
  {
    id: "aws-private-subnet-b",
    provider: "aws",
    kind: "subnet",
    label: "Private Subnet B",
    layerOrder: 9,
    parentZoneId: "aws-vpc-primary",
    config: {
      availabilityZoneName: "us-east-1b",
      cidrBlock: "10.0.12.0/24",
      cidrIpv4: "10.0.12.0/24",
      cidrIpv6: "2001:db8:12:b::/64",
      ipAddressFamily: "dualstack",
      subnetAccess: "private",
      dnsResolution: true,
      dnsHostnames: true,
      routeTableName: "private-b",
      routeTarget: "nat-gateway",
      routePropagation: false,
      networkAclMode: "allow",
    },
    layout: { x: 53.5, y: 63, width: 35, height: 21 },
  },
  {
    id: "aws-data-tier",
    provider: "aws",
    kind: "data-tier",
    label: "Data Tier",
    layerOrder: 10,
    parentZoneId: "aws-vpc-primary",
    layout: { x: 53.5, y: 63, width: 35, height: 21 },
  },
];

const awsBaseRouteTables: ArchitectureRouteTable[] = [
  {
    id: "rtb-public-a",
    provider: "aws",
    label: "public-a",
    vpcId: "aws-vpc-primary",
    associatedSubnetIds: ["aws-public-subnet-a"],
    routes: [
      { id: "rtb-public-a-local", destination: "10.0.0.0/16", targetType: "local", status: "active", learningNote: "Local VPC route is created automatically." },
      { id: "rtb-public-a-default", destination: "0.0.0.0/0", targetType: "internet-gateway", status: "active", learningNote: "Public subnets become public through a default route to an Internet Gateway." },
    ],
  },
  {
    id: "rtb-public-b",
    provider: "aws",
    label: "public-b",
    vpcId: "aws-vpc-primary",
    associatedSubnetIds: ["aws-public-subnet-b"],
    routes: [
      { id: "rtb-public-b-local", destination: "10.0.0.0/16", targetType: "local", status: "active", learningNote: "Local VPC route is created automatically." },
      { id: "rtb-public-b-default", destination: "0.0.0.0/0", targetType: "internet-gateway", status: "active", learningNote: "Public subnets become public through a default route to an Internet Gateway." },
    ],
  },
  {
    id: "rtb-private-a",
    provider: "aws",
    label: "private-a",
    vpcId: "aws-vpc-primary",
    associatedSubnetIds: ["aws-private-subnet-a"],
    routes: [
      { id: "rtb-private-a-local", destination: "10.0.0.0/16", targetType: "local", status: "active", learningNote: "Local VPC route is created automatically." },
      { id: "rtb-private-a-default", destination: "0.0.0.0/0", targetType: "nat-gateway", status: "active", learningNote: "Private subnet outbound internet access usually routes through NAT." },
    ],
  },
  {
    id: "rtb-private-b",
    provider: "aws",
    label: "private-b",
    vpcId: "aws-vpc-primary",
    associatedSubnetIds: ["aws-private-subnet-b"],
    routes: [
      { id: "rtb-private-b-local", destination: "10.0.0.0/16", targetType: "local", status: "active", learningNote: "Local VPC route is created automatically." },
      { id: "rtb-private-b-default", destination: "0.0.0.0/0", targetType: "nat-gateway", status: "active", learningNote: "Private subnet outbound internet access usually routes through NAT." },
    ],
  },
];

export function createEmptyArchitectureGraph(scenario: Scenario): ArchitectureGraph {
  return {
    provider: scenario.provider,
    scenarioId: scenario.id,
    zones: scenario.provider === "aws" ? awsBaseZones : [],
    routeTables: scenario.provider === "aws" ? awsBaseRouteTables : [],
    nodes: [],
    edges: [],
  };
}

export function createLearnerScenarioState(scenario: Scenario): LearnerScenarioState {
  return {
    scenarioId: scenario.id,
    provider: scenario.provider,
    graph: createEmptyArchitectureGraph(scenario),
    selection: {},
    status: "idle",
    attempts: 0,
    simulation: createIdleSimulation(),
  };
}

function createAwsScenarioPreviewNodes(scenario: Scenario): ArchitectureNode[] {
  if (scenario.id !== "aws-saa-ha-web-private-db") {
    return [];
  }

  return [
    {
      id: "node-route-53",
      serviceId: "aws-route-53",
      label: "Route 53",
      position: { x: 12, y: 12 },
      zoneId: "aws-global-edge",
      config: {},
    },
    {
      id: "node-alb",
      serviceId: "aws-alb",
      label: "ALB",
      position: { x: 27, y: 40 },
      zoneId: "aws-public-subnet-a",
      config: { highAvailability: true },
    },
    {
      id: "node-auto-scaling",
      serviceId: "aws-auto-scaling",
      label: "Auto Scaling",
      position: { x: 28, y: 66 },
      zoneId: "aws-private-subnet-a",
      config: { desiredCapacity: 2, highAvailability: true, multiAz: true },
    },
    {
      id: "node-cloudwatch",
      serviceId: "aws-cloudwatch",
      label: "CloudWatch",
      position: { x: 84, y: 23 },
      zoneId: "aws-region-primary",
      config: {},
    },
    {
      id: "node-rds",
      serviceId: "aws-rds",
      label: "RDS",
      position: { x: 71, y: 66 },
      zoneId: "aws-private-subnet-b",
      config: { encryptionAtRest: true, multiAz: true },
    },
  ];
}

export function createPreviewArchitectureGraph(scenario: Scenario): ArchitectureGraph {
  const graph = createEmptyArchitectureGraph(scenario);

  return {
    ...graph,
    nodes: scenario.provider === "aws" ? createAwsScenarioPreviewNodes(scenario) : [],
    edges:
      scenario.id === "aws-saa-ha-web-private-db"
        ? [
            {
              id: "edge-route53-alb",
              sourceNodeId: "node-route-53",
              targetNodeId: "node-alb",
              kind: "request",
              label: "DNS + HTTPS",
            },
            {
              id: "edge-alb-app",
              sourceNodeId: "node-alb",
              targetNodeId: "node-auto-scaling",
              kind: "request",
              label: "HTTPS",
            },
            {
              id: "edge-app-rds",
              sourceNodeId: "node-auto-scaling",
              targetNodeId: "node-rds",
              kind: "data",
              label: "Private SQL",
              direction: "two-way",
            },
            {
              id: "edge-app-cloudwatch",
              sourceNodeId: "node-auto-scaling",
              targetNodeId: "node-cloudwatch",
              kind: "observe",
              label: "Metrics + logs",
            },
            {
              id: "edge-rds-cloudwatch",
              sourceNodeId: "node-rds",
              targetNodeId: "node-cloudwatch",
              kind: "observe",
              label: "DB metrics",
            },
          ]
        : [],
  };
}

export function createPreviewLearnerScenarioState(scenario: Scenario): LearnerScenarioState {
  return {
    ...createLearnerScenarioState(scenario),
    graph: createPreviewArchitectureGraph(scenario),
    status: "editing",
  };
}
