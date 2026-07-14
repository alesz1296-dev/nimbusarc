# NimbusArc Implementation Roadmap

This roadmap is the implementation map for the product overview and feature inventory. Tasks in `docs/tasks.md` remain the execution tracker; this document describes phase intent and exit criteria.

## Phase 0 - Foundation

Status: mostly established.

Focus:

- React and TypeScript shell
- separated UI, feature, domain, data, and integration boundaries
- AWS provider registry and seed catalogue
- project standards and visual QA workflow
- NimbusArc naming and repository workflow

Exit criteria: contributors can run, build, inspect, and extend the application using the documented workflow.

## Phase 1 - Playable AWS SAA Canvas

Status: substantially implemented; scenario grading still needs completion.

Focus:

- domain-owned architecture graph
- service and scope placement
- selection, movement, resizing, deletion, and reset
- connection creation and validation
- directional flow simulation
- first scenario submission and feedback loop

Exit criteria: a learner can complete one AWS SAA scenario without AWS credentials or AWS charges.

## Phase 2 - Architecture State And Quality Of Life

Priority: next.

Focus:

- save/load architecture locally
- undo/redo command history
- duplicate and copy/paste groups
- architecture naming and scenario workspace state
- richer empty, loading, invalid, and recovery states
- visual regression checklist for desktop and mobile

Exit criteria: a learner can safely iterate on an architecture without losing work.

## Phase 3 - AWS Network And Security Simulator

Focus:

- route tables and route propagation
- CIDR and overlap validation
- stateful security-group rules by protocol, port, and source
- ordered stateless NACL rules
- VPC endpoints, NAT, IGW, peering, and Transit Gateway behavior
- IAM policy statements and explicit-deny evaluation
- resource policies, permission boundaries, and SCP concepts

Exit criteria: the simulator can explain why a specific request is allowed or denied at each network and identity boundary.

## Phase 4 - Workloads And Resource Lifecycles

Focus:

- creating, available, updating, failed, recovering, and unhealthy states
- EC2 boot and health checks
- ALB target health and Auto Scaling replacement
- RDS failover and backup behavior
- Lambda cold starts and throttling
- queues, retries, visibility, DLQs, and event delivery
- failure injection and recovery exercises

Exit criteria: learners can run a workload, introduce a failure, and diagnose it using simulated signals.

## Phase 5 - Cost, Billing, And Optimization

Focus:

- region-specific price profiles
- usage, data transfer, storage, IOPS, and LCU calculations
- free tier, discounts, reservations, and Savings Plans
- budgets, alerts, cost allocation tags, and ownership
- daily/monthly views and architecture comparison
- optimization recommendations tied to SAA tradeoffs

Exit criteria: cost results show assumptions, line items, and explainable optimization choices.

## Phase 6 - IaC, CLI, And Reusable Examples

Focus:

- AWS CLI command generation
- Terraform modules and variable explanations
- CloudFormation and CDK examples
- security-group, IAM, route, and storage generation
- validate generated artifacts
- visual architecture versus IaC diff
- import from Terraform where mappings are unambiguous

Exit criteria: learners can move from a diagram to understandable implementation artifacts without losing the architecture intent.

## Phase 7 - Learning Intelligence And Provider Expansion

Focus:

- scenario bank and domain-specific learning paths
- AI customer requirements role-play
- adaptive difficulty and learner progress
- instructor-authored course mappings
- provider-neutral contracts
- Azure and GCP adapters
- cross-provider architecture comparison

Exit criteria: AWS remains a deep first-class experience while other providers can be added without rewriting the canvas or learner loop.

## Priority Rule

Stabilize the AWS graph, networking, security, and learning semantics before adding provider breadth. Provider expansion should follow proven provider-neutral interfaces, not drive them prematurely.
