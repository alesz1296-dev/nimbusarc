# NimbusArc Product Overview

## Mission

NimbusArc is a visual, interactive cloud architecture learning platform. Its first learning track is AWS Solutions Architect - Associate (SAA). Learners build architectures on a canvas, configure services and network boundaries, run simulations, receive feedback, and gradually translate visual decisions into AWS CLI, Terraform, CloudFormation, or CDK.

The product is designed to teach architecture reasoning without requiring an AWS account or creating AWS charges.

## Product Boundaries

NimbusArc is currently an architecture and learning simulator. It is not an AWS account emulator and does not provision real infrastructure.

The current simulator models learning-relevant behavior such as:

- service placement and relationships
- network scope and directional flows
- selected security controls
- resource configuration
- educational cost estimates
- basic flow and security outcomes

Future LocalStack, AWS CLI, Terraform, or sandbox integrations should remain optional execution adapters. The visual learning model must work without them.

## Current Foundation

- AWS service palette with search, categories, icons, and service reference content
- Regions, VPCs, Availability Zones, public/private subnets, and data tiers
- Dragging, resizing, zooming, multi-selection, keyboard shortcuts, and panel controls
- Directional, two-way, many-to-many connections with AWS compatibility checks
- Curved connection paths with flowing and blocked animations
- Flow simulation with route, security-group, and NACL controls
- Service-specific configuration for EC2, Lambda, RDS, DynamoDB, S3, SQS, API Gateway, and more
- EC2 AMI, operating system, instance type, EBS, instance store, and snapshot options
- Expandable service learning sections: summary, configuration, features, limitations, advanced configuration, and use cases
- Educational cost estimator with editable workload assumptions
- Initial security assessment for IAM posture, public exposure, encryption, firewalls, routes, security groups, and NACLs

## Product Principles

1. Learning value comes before infrastructure realism.
2. Every visual interaction should map to an explainable architecture decision.
3. Provider-specific behavior belongs behind provider adapters where practical.
4. Estimates and simulations must disclose assumptions and limitations.
5. The canvas, domain model, and UI controls remain loosely coupled.
6. AWS is the first provider; Azure and other providers remain future adapters, not premature abstractions.

## Primary Learner Loop

1. Read a customer scenario.
2. Place services and network scopes.
3. Configure service behavior and security controls.
4. Connect services with valid data flows.
5. Run flow, security, and cost analysis.
6. Diagnose failures or tradeoffs.
7. Submit the architecture for SAA-focused evaluation.
8. Review explanations and generate implementation artifacts.
