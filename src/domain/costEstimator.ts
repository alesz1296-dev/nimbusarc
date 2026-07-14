import type { ArchitectureGraph, ArchitectureNode } from "./graph";
import type { CloudService } from "./types";

export type CostAssumptions = {
  monthlyHours: number;
  monthlyRequestsMillions: number;
  monthlyStorageGb: number;
  monthlyDataTransferGb: number;
};

export type CostEstimateLine = {
  nodeId: string;
  serviceName: string;
  monthlyCost: number;
  detail: string;
};

export type CostEstimate = {
  lines: CostEstimateLine[];
  totalMonthlyCost: number;
  assumptions: CostAssumptions;
  disclaimer: string;
};

const hoursPerMonth = 730;

const ec2HourlyRates: Record<string, number> = {
  "t3.micro": 0.0104,
  "t3.small": 0.0208,
  "t3.medium": 0.0416,
  "m7g.medium": 0.0462,
  "m7i.large": 0.1008,
};

const rdsHourlyRates: Record<string, number> = {
  "db.t4g.micro": 0.017,
  "db.t4g.small": 0.034,
  "db.r6g.large": 0.24,
  "db.r6g.xlarge": 0.48,
};

const storageRates: Record<string, number> = {
  gp3: 0.08,
  io2: 0.125,
  st1: 0.045,
  sc1: 0.015,
};

function roundCost(value: number) {
  return Math.round(value * 100) / 100;
}

function estimateNodeCost(node: ArchitectureNode, assumptions: CostAssumptions): { monthlyCost: number; detail: string } {
  const config = node.config;
  const count = Math.max(1, config.desiredCapacity ?? (node.serviceId === "aws-ec2" ? 1 : 1));

  if (node.serviceId === "aws-ec2") {
    const instanceRate = ec2HourlyRates[config.ec2InstanceType ?? "t3.micro"] ?? ec2HourlyRates["t3.micro"];
    const rootGb = config.ec2RootVolumeGb ?? 8;
    const rootRate = storageRates[config.ec2RootVolumeType ?? "gp3"] ?? 0.08;
    const dataGb = (config.ec2DataVolumeGb ?? 0) * (config.ec2DataVolumeCount ?? 0);
    const dataRate = storageRates[config.ec2DataVolumeType ?? "gp3"] ?? 0.08;
    const snapshotGb = config.ec2SnapshotEnabled ? rootGb + dataGb : 0;
    const snapshotCost = snapshotGb * 0.05;
    const monthlyCost = count * instanceRate * assumptions.monthlyHours + rootGb * rootRate + dataGb * dataRate + snapshotCost;
    return {
      monthlyCost,
      detail: `${count} x ${config.ec2InstanceType ?? "t3.micro"}, ${rootGb + dataGb} GB EBS${config.ec2InstanceStore ? ", instance store" : ""}${config.ec2SnapshotEnabled ? ", snapshots" : ""}`,
    };
  }

  if (node.serviceId === "aws-rds") {
    const classRate = rdsHourlyRates[config.rdsInstanceClass ?? "db.t4g.micro"] ?? rdsHourlyRates["db.t4g.micro"];
    const storageGb = config.rdsStorageGb ?? 20;
    const storageRate = config.rdsStorageType === "io2" ? 0.125 : 0.115;
    const replicaCost = (config.readReplicas ?? 0) * classRate * assumptions.monthlyHours;
    return {
      monthlyCost: classRate * assumptions.monthlyHours + replicaCost + storageGb * storageRate,
      detail: `${config.rdsEngine ?? "PostgreSQL"} ${config.rdsInstanceClass ?? "db.t4g.micro"}, ${storageGb} GB storage${config.multiAz ? ", Multi-AZ" : ""}`,
    };
  }

  if (node.serviceId === "aws-lambda") {
    const requestCost = assumptions.monthlyRequestsMillions * 0.2;
    const computeCost = assumptions.monthlyRequestsMillions * (config.lambdaMemoryMb ?? 128) * (config.lambdaTimeoutSeconds ?? 1) * 0.0000000000167;
    return {
      monthlyCost: requestCost + computeCost,
      detail: `${config.lambdaRuntime ?? "Python 3.13"}, ${config.lambdaMemoryMb ?? 128} MB, ${assumptions.monthlyRequestsMillions}M requests/month`,
    };
  }

  if (node.serviceId === "aws-s3") {
    const rate = config.s3StorageClass === "intelligent-tiering" ? 0.023 : config.s3StorageClass === "glacier-instant" ? 0.004 : 0.023;
    return {
      monthlyCost: assumptions.monthlyStorageGb * rate + assumptions.monthlyRequestsMillions * 0.004,
      detail: `${assumptions.monthlyStorageGb} GB ${config.s3StorageClass ?? "standard"} storage`,
    };
  }

  if (node.serviceId === "aws-nat-gateway") {
    return { monthlyCost: 0.045 * assumptions.monthlyHours + assumptions.monthlyDataTransferGb * 0.045, detail: "Hourly charge plus per-GB processing" };
  }

  if (node.serviceId === "aws-alb" || node.serviceId === "aws-nlb") {
    return { monthlyCost: 0.0225 * assumptions.monthlyHours, detail: "Load balancer hourly baseline; LCU usage not modeled" };
  }

  if (node.serviceId === "aws-api-gateway") {
    return { monthlyCost: assumptions.monthlyRequestsMillions, detail: `${assumptions.monthlyRequestsMillions}M API requests/month` };
  }

  if (node.serviceId === "aws-cloudfront") {
    return { monthlyCost: assumptions.monthlyDataTransferGb * 0.085, detail: `${assumptions.monthlyDataTransferGb} GB edge data transfer/month` };
  }

  if (node.serviceId === "aws-dynamodb") {
    return { monthlyCost: assumptions.monthlyRequestsMillions * 0.25, detail: `${assumptions.monthlyRequestsMillions}M requests/month; capacity mode is educationally approximated` };
  }

  return { monthlyCost: 0, detail: "No baseline charge modeled; review usage-based pricing" };
}

export function estimateArchitectureCost(
  graph: ArchitectureGraph,
  servicesById: Map<string, CloudService>,
  assumptions: CostAssumptions,
): CostEstimate {
  const lines = graph.nodes.map((node) => {
    const estimate = estimateNodeCost(node, assumptions);
    return {
      nodeId: node.id,
      serviceName: servicesById.get(node.serviceId)?.name ?? node.label,
      monthlyCost: roundCost(estimate.monthlyCost),
      detail: estimate.detail,
    };
  });

  return {
    lines,
    totalMonthlyCost: roundCost(lines.reduce((total, line) => total + line.monthlyCost, 0)),
    assumptions,
    disclaimer: "Educational estimate only. AWS pricing varies by region, usage, discounts, data transfer, taxes, and account commitments.",
  };
}
