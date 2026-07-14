# Security And Cost Model

## Current Security Model

NimbusArc currently supports an educational security pass with:

- edge-level route, security-group, and NACL allow/deny controls
- node-level firewall mode
- high-level IAM posture: least privilege, broad, or none
- public data-store exposure checks
- encryption-at-rest checks
- public edge protection warnings

This is intentionally a teaching model, not an AWS policy engine. Findings must be labeled as simulated and explain the control that caused them.

## Target Security Model

The next security model should represent a request as:

```text
Request
  principal
  source resource
  destination resource
  action
  protocol and port
  source and destination address
  context and conditions
```

Evaluation order should make AWS SAA reasoning visible:

1. Network reachability and route selection.
2. NACL evaluation.
3. Security-group stateful evaluation.
4. Firewall or WAF evaluation.
5. IAM identity policy.
6. Resource policy.
7. Permission boundary, session policy, and SCP constraints.
8. Explicit deny precedence.

## Current Cost Model

The current estimator is a provider-specific educational baseline. It uses editable assumptions for hours, requests, storage, and transfer, then estimates configured resources such as EC2, EBS, snapshots, RDS, Lambda, S3, NAT Gateway, load balancers, API Gateway, CloudFront, and DynamoDB.

It is not a replacement for the AWS Pricing Calculator. Results should never imply an invoice or guaranteed AWS charge.

## Target Cost Model

Pricing should be represented as provider and region profiles:

```text
PricingProfile
  provider
  region
  effectiveDate
  currency
  resourceRates
  usageRates
  discounts
  freeTier
```

Every estimate should expose its assumptions, rate source, effective date, and omitted factors. This makes pricing useful for both learning and later integration with official pricing data.
