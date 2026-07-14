import type { ArchitectureEdgeKind, ArchitectureNode } from "./graph";
import type { CloudService } from "./types";

export type ConnectionValidationResult = {
  allowed: boolean;
  reason?: string;
};

export type ConnectionBlueprint = {
  kind: ArchitectureEdgeKind;
  label?: string;
  direction?: "one-way" | "two-way";
};

function normalizeName(serviceName: string): string {
  return serviceName.replace(/^Amazon\s+/i, "").trim();
}

function formatTrafficSharePercent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function servicesAreLinked(sourceService: CloudService, targetService: CloudService) {
  return (
    sourceService.allowedConnections.includes(targetService.id) ||
    targetService.allowedConnections.includes(sourceService.id)
  );
}

export function canServicesConnect(
  sourceService: CloudService | undefined,
  targetService: CloudService | undefined,
): ConnectionValidationResult {
  if (!sourceService || !targetService) {
    return {
      allowed: false,
      reason: "The selected service metadata is incomplete.",
    };
  }

  if (sourceService.id === targetService.id) {
    return {
      allowed: false,
      reason: "Choose a different service to create a connection.",
    };
  }

  if (servicesAreLinked(sourceService, targetService)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `${sourceService.name} does not usually connect directly to ${targetService.name} in this AWS SAA trainer.`,
  };
}

export function getConnectableServiceIds(
  sourceService: CloudService | undefined,
  servicesById?: Map<string, CloudService>,
): string[] {
  if (!sourceService) {
    return [];
  }

  const connectableIds = new Set(sourceService.allowedConnections);

  servicesById?.forEach((service) => {
    if (service.id !== sourceService.id && service.allowedConnections.includes(sourceService.id)) {
      connectableIds.add(service.id);
    }
  });

  return [...connectableIds];
}

export function inferConnectionBlueprint(
  sourceNode: ArchitectureNode,
  targetNode: ArchitectureNode,
): ConnectionBlueprint {
  const sourceId = sourceNode.serviceId;
  const targetId = targetNode.serviceId;

  if (sourceId === "aws-user" || sourceId === "aws-client") {
    return {
      kind: "request",
      label: targetId === "aws-route-53" ? "DNS lookup" : "HTTPS request",
      direction: "one-way",
    };
  }

  if (sourceId === "aws-route-53") {
    if (targetId === "aws-alb" && targetNode.config.trafficSharePercent) {
      return {
        kind: "request",
        label: `${formatTrafficSharePercent(targetNode.config.trafficSharePercent)} traffic`,
        direction: "one-way",
      };
    }

    return {
      kind: "request",
      label: "DNS + HTTPS",
      direction: "one-way",
    };
  }

  if (sourceId === "aws-cloudfront") {
    if (targetId === "aws-alb" && targetNode.config.trafficSharePercent) {
      return {
        kind: "request",
        label: `${formatTrafficSharePercent(targetNode.config.trafficSharePercent)} traffic`,
        direction: "one-way",
      };
    }

    return {
      kind: "request",
      label: "Edge request",
      direction: "one-way",
    };
  }

  if (sourceId === "aws-alb") {
    return {
      kind: "request",
      label: "HTTPS",
      direction: "one-way",
    };
  }

  if (sourceId === "aws-auto-scaling" && targetId === "aws-rds") {
    return {
      kind: "data",
      label: "Private SQL",
      direction: "two-way",
    };
  }

  if (sourceId === "aws-auto-scaling" && targetId === "aws-cloudwatch") {
    return {
      kind: "observe",
      label: "Metrics + logs",
      direction: "one-way",
    };
  }

  if (sourceId === "aws-rds" && targetId === "aws-cloudwatch") {
    return {
      kind: "observe",
      label: "DB metrics",
      direction: "one-way",
    };
  }

  if (
    (sourceId === "aws-internet-gateway" && targetId === "aws-ec2") ||
    (sourceId === "aws-ec2" && targetId === "aws-internet-gateway")
  ) {
    return {
      kind: "request",
      label: "Public route",
      direction: "two-way",
    };
  }

  if (
    (sourceId === "aws-internet-gateway" && targetId === "aws-nat-gateway") ||
    (sourceId === "aws-nat-gateway" && targetId === "aws-internet-gateway")
  ) {
    return {
      kind: "request",
      label: "Internet egress",
      direction: "two-way",
    };
  }

  if (
    (sourceId === "aws-nat-gateway" && targetId === "aws-ec2") ||
    (sourceId === "aws-ec2" && targetId === "aws-nat-gateway")
  ) {
    return {
      kind: "request",
      label: "Outbound path",
      direction: "two-way",
    };
  }

  if (
    (sourceId === "aws-internet-gateway" && targetId === "aws-alb") ||
    (sourceId === "aws-alb" && targetId === "aws-internet-gateway")
  ) {
    return {
      kind: "request",
      label: "Ingress + egress",
      direction: "two-way",
    };
  }

  if (targetId === "aws-cloudwatch") {
    return {
      kind: "observe",
      label: "Monitoring",
      direction: "one-way",
    };
  }

  if (targetId === "aws-rds") {
    return {
      kind: "data",
      label: "App data",
      direction: "two-way",
    };
  }

  return {
    kind: "request",
    label: `${normalizeName(sourceNode.label)} -> ${normalizeName(targetNode.label)}`,
    direction: "one-way",
  };
}
