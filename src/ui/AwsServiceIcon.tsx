import { isValidElement } from "react";
import { awsGroupIcons, awsServiceIcons } from "@ningz6/cloudscape-aws-icons";
import { Monitor, UserRound } from "lucide-react";

const serviceIconMap: Record<string, string> = {
  "aws-route-53": "aws-route-53",
  "aws-cloudfront": "aws-cloudfront",
  "aws-api-gateway": "aws-api-gateway",
  "aws-s3": "aws-simple-storage-service",
  "aws-vpc": "aws-group-virtual-private-cloud-vpc",
  "aws-public-subnet": "aws-group-public-subnet",
  "aws-private-subnet": "aws-group-private-subnet",
  "aws-internet-gateway": "aws-transit-gateway",
  "aws-nat-gateway": "aws-transit-gateway",
  "aws-transit-gateway": "aws-transit-gateway",
  "aws-vpn-gateway": "aws-site-to-site-vpn",
  "aws-direct-connect": "aws-direct-connect",
  "aws-alb": "aws-elastic-load-balancing",
  "aws-nlb": "aws-elastic-load-balancing",
  "aws-auto-scaling": "aws-group-auto-scaling-group",
  "aws-ec2": "aws-ec2",
  "aws-lambda": "aws-lambda",
  "aws-rds": "aws-rds",
  "aws-dynamodb": "aws-dynamodb",
  "aws-elasticache": "aws-elasticache",
  "aws-efs": "aws-efs",
  "aws-sqs": "aws-simple-queue-service",
  "aws-sns": "aws-simple-notification-service",
  "aws-eventbridge": "aws-eventbridge",
  "aws-kinesis": "aws-kinesis-data-streams",
  "aws-opensearch": "aws-opensearch-service",
  "aws-cloudwatch": "aws-cloudwatch",
  "aws-cloudtrail": "aws-cloudtrail",
  "aws-iam": "aws-iam-identity-center",
  "aws-waf": "aws-waf",
  "aws-kms": "aws-key-management-service",
  "aws-secrets-manager": "aws-secrets-manager",
};

export const serviceAccentColorMap: Record<string, string> = {
  "aws-user": "#253246",
  "aws-client": "#253246",
  "aws-route-53": "#7c4dff",
  "aws-cloudfront": "#7b61ff",
  "aws-api-gateway": "#d72855",
  "aws-s3": "#2f8f2f",
  "aws-vpc": "#2f8f2f",
  "aws-public-subnet": "#1b88d1",
  "aws-private-subnet": "#2f6bff",
  "aws-internet-gateway": "#6d3fb9",
  "aws-nat-gateway": "#6d3fb9",
  "aws-transit-gateway": "#6d3fb9",
  "aws-vpn-gateway": "#6d3fb9",
  "aws-direct-connect": "#6d3fb9",
  "aws-alb": "#8b5cf6",
  "aws-nlb": "#8b5cf6",
  "aws-auto-scaling": "#f59e0b",
  "aws-ec2": "#f97316",
  "aws-lambda": "#f97316",
  "aws-rds": "#c026d3",
  "aws-dynamodb": "#4053d6",
  "aws-elasticache": "#4053d6",
  "aws-efs": "#2f8f2f",
  "aws-sqs": "#c2185b",
  "aws-sns": "#c2185b",
  "aws-eventbridge": "#c2185b",
  "aws-kinesis": "#7c3aed",
  "aws-opensearch": "#7c3aed",
  "aws-cloudwatch": "#e11d74",
  "aws-cloudtrail": "#e11d74",
  "aws-iam": "#dd6b20",
  "aws-waf": "#dd6b20",
  "aws-kms": "#dd6b20",
  "aws-secrets-manager": "#dd6b20",
};

const actorIconMap = {
  "aws-user": UserRound,
  "aws-client": Monitor,
} satisfies Record<string, typeof UserRound>;

type AwsServiceIconProps = {
  serviceId: string;
  label: string;
  size?: "sm" | "md";
};

export function AwsServiceIcon({ serviceId, label, size = "md" }: AwsServiceIconProps) {
  const actorIcon = actorIconMap[serviceId as keyof typeof actorIconMap];

  if (actorIcon) {
    const ActorIcon = actorIcon;

    return (
      <span
        aria-label={label}
        className={`aws-service-icon aws-service-icon--actor aws-service-icon--${size}`}
        role="img"
      >
        <ActorIcon aria-hidden="true" strokeWidth={2.2} />
      </span>
    );
  }

  const iconKey = serviceIconMap[serviceId];
  const icon =
    (iconKey ? awsServiceIcons[iconKey as keyof typeof awsServiceIcons] : undefined) ??
    (iconKey ? awsGroupIcons[iconKey as keyof typeof awsGroupIcons] : undefined);

  if (!icon || !isValidElement(icon)) {
    return (
      <span
        aria-hidden="true"
        className={`aws-service-icon aws-service-icon--fallback aws-service-icon--${size}`}
      >
        {label.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className={`aws-service-icon aws-service-icon--${size}`}
      role="img"
    >
      {icon}
    </span>
  );
}
