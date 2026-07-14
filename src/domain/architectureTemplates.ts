import type { Scenario } from "./types";
import type { ArchitectureGraph } from "./graph";
import { addNode, connectNodes } from "./graphCommands";
import { createEmptyArchitectureGraph } from "./graphFactory";

export type ArchitectureTemplate = {
  id: string;
  name: string;
  description: string;
  createGraph: (scenario: Scenario) => ArchitectureGraph;
};

const templateNode = (
  graph: ArchitectureGraph,
  serviceId: string,
  label: string,
  position: { x: number; y: number },
  zoneId?: string,
  config: Record<string, unknown> = {},
) => addNode(graph, { serviceId, label, position, zoneId, config });

function withNodes(scenario: Scenario, nodes: Array<{ serviceId: string; label: string; position: { x: number; y: number }; zoneId?: string; config?: Record<string, unknown> }>, edges: Array<{ source: number; target: number; kind: "request" | "data" | "event" | "observe"; label: string; direction?: "one-way" | "two-way" }>) {
  let graph = createEmptyArchitectureGraph(scenario);
  const nodeIds: string[] = [];

  nodes.forEach((node) => {
    graph = templateNode(graph, node.serviceId, node.label, node.position, node.zoneId, node.config);
    nodeIds.push(graph.nodes[graph.nodes.length - 1].id);
  });

  edges.forEach((edge) => {
    graph = connectNodes(graph, {
      sourceNodeId: nodeIds[edge.source],
      targetNodeId: nodeIds[edge.target],
      kind: edge.kind,
      label: edge.label,
      direction: edge.direction,
    });
  });

  return graph;
}

export const architectureTemplates: ArchitectureTemplate[] = [
  {
    id: "ha-web-private-db",
    name: "Highly available web app",
    description: "Route 53, ALB, Auto Scaling, private RDS, and CloudWatch across a regional network.",
    createGraph: (scenario) => withNodes(scenario, [
      { serviceId: "aws-route-53", label: "Route 53", position: { x: 14, y: 10 }, zoneId: "aws-global-edge" },
      { serviceId: "aws-alb", label: "ALB", position: { x: 29, y: 39 }, zoneId: "aws-public-subnet-a", config: { highAvailability: true, multiAz: true, publicAccess: true } },
      { serviceId: "aws-auto-scaling", label: "Auto Scaling", position: { x: 34, y: 66 }, zoneId: "aws-private-subnet-a", config: { highAvailability: true, multiAz: true, desiredCapacity: 2 } },
      { serviceId: "aws-rds", label: "RDS", position: { x: 70, y: 66 }, zoneId: "aws-private-subnet-b", config: { highAvailability: true, multiAz: true, encryptionAtRest: true } },
      { serviceId: "aws-cloudwatch", label: "CloudWatch", position: { x: 84, y: 18 }, zoneId: "aws-region-primary" },
    ], [
      { source: 0, target: 1, kind: "request", label: "DNS + HTTPS" },
      { source: 1, target: 2, kind: "request", label: "HTTPS" },
      { source: 2, target: 3, kind: "data", label: "Private SQL", direction: "two-way" },
      { source: 2, target: 4, kind: "observe", label: "Metrics + logs" },
      { source: 3, target: 4, kind: "observe", label: "DB metrics" },
    ]),
  },
  {
    id: "serverless-api",
    name: "Serverless API",
    description: "API Gateway, Lambda, DynamoDB, SQS, and CloudWatch for an event-driven backend.",
    createGraph: (scenario) => withNodes(scenario, [
      { serviceId: "aws-client", label: "Client App", position: { x: 10, y: 42 }, zoneId: "aws-global-edge" },
      { serviceId: "aws-api-gateway", label: "API Gateway", position: { x: 28, y: 42 }, zoneId: "aws-global-edge", config: { publicAccess: true, apiAuthorization: "iam", apiThrottling: true } },
      { serviceId: "aws-lambda", label: "Lambda", position: { x: 48, y: 42 }, zoneId: "aws-private-subnet-a", config: { lambdaRuntime: "python3.13", lambdaMemoryMb: 512, iamPolicyMode: "least-privilege" } },
      { serviceId: "aws-dynamodb", label: "DynamoDB", position: { x: 70, y: 30 }, zoneId: "aws-region-primary", config: { encryptionAtRest: true, pointInTimeRecovery: true } },
      { serviceId: "aws-sqs", label: "SQS", position: { x: 70, y: 60 }, zoneId: "aws-region-primary", config: { queueType: "standard", deadLetterQueue: true } },
      { serviceId: "aws-cloudwatch", label: "CloudWatch", position: { x: 86, y: 42 }, zoneId: "aws-region-primary" },
    ], [
      { source: 0, target: 1, kind: "request", label: "HTTPS" },
      { source: 1, target: 2, kind: "request", label: "Invoke" },
      { source: 2, target: 3, kind: "data", label: "Read/write" },
      { source: 2, target: 4, kind: "event", label: "Enqueue" },
      { source: 2, target: 5, kind: "observe", label: "Logs + metrics" },
    ]),
  },
  {
    id: "static-site-cdn",
    name: "Static site with CDN",
    description: "Route 53 and CloudFront deliver a private S3 static website globally.",
    createGraph: (scenario) => withNodes(scenario, [
      { serviceId: "aws-user", label: "Users", position: { x: 10, y: 38 }, zoneId: "aws-global-edge" },
      { serviceId: "aws-route-53", label: "Route 53", position: { x: 29, y: 20 }, zoneId: "aws-global-edge" },
      { serviceId: "aws-cloudfront", label: "CloudFront", position: { x: 48, y: 38 }, zoneId: "aws-global-edge", config: { publicAccess: true, enableManagedRules: true } },
      { serviceId: "aws-s3", label: "S3", position: { x: 72, y: 38 }, zoneId: "aws-region-primary", config: { encryptionAtRest: true, blockPublicAccess: true, versioning: true, lifecycleRules: true } },
      { serviceId: "aws-cloudwatch", label: "CloudWatch", position: { x: 86, y: 68 }, zoneId: "aws-region-primary" },
    ], [
      { source: 0, target: 1, kind: "request", label: "DNS lookup" },
      { source: 1, target: 2, kind: "request", label: "DNS + HTTPS" },
      { source: 2, target: 3, kind: "data", label: "Cached objects" },
      { source: 3, target: 4, kind: "observe", label: "Access logs" },
    ]),
  },
];
