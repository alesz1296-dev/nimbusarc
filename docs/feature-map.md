# NimbusArc Feature Map

Status values: `Current`, `Partial`, `Planned`.

## Canvas And Interaction

| Capability | Status | Notes |
| --- | --- | --- |
| Add services from palette | Current | AWS catalogue-backed |
| Search and category filtering | Current | Core and network scope modes |
| Move, resize, delete, and reset | Current | Nodes and network scopes |
| Zoom and pan behavior | Current | Mouse wheel zoom |
| Single and multi-selection | Current | Ctrl/Cmd click and selection box |
| Keyboard shortcuts | Current | Delete, reset, connect, select all, simulation |
| Four-way connection handles | Current | Left, right, top, and bottom |
| AWS compatibility validation | Current | Service allow-list model |
| Many-to-many edges | Current | Independent graph edges |
| Curved animated flows | Current | Flowing and blocked states |
| Undo/redo history | Planned | Required before complex editing expands |
| Save/load architecture | Planned | Browser storage first |
| Copy/paste and duplicate groups | Planned | Quality-of-life improvement |

## AWS Architecture Model

| Capability | Status | Notes |
| --- | --- | --- |
| Regions | Current | Scope zone |
| VPCs | Current | Scope zone |
| Availability Zones | Current | Scope zone with assignment |
| Public/private subnets | Current | Access-aware styling |
| Route tables | Planned | Required for realistic routing |
| Internet Gateway and NAT behavior | Partial | Services exist; behavior is simplified |
| VPC endpoints | Planned | Gateway and interface endpoint behavior |
| Transit Gateway route tables | Planned | Hub-and-spoke learning |
| VPC peering constraints | Planned | CIDR and route validation |
| IPv4 and IPv6 | Planned | Addressing and route validation |
| DNS resolution paths | Planned | Route 53 and VPC resolver behavior |

## Service Behavior

| Capability | Status | Notes |
| --- | --- | --- |
| Service-specific inspector templates | Current | Typed controls by service |
| EC2 AMI and OS selection | Current | Includes instance type and architecture |
| EBS, instance store, and snapshots | Current | Modeled in EC2 configuration |
| Lambda runtime and execution settings | Current | Runtime, memory, timeout, storage |
| Database internal previews | Current | Relational, document, and cache examples |
| Resource lifecycle states | Planned | Creating, available, failed, recovering, etc. |
| Health checks and target state | Partial | ALB target-group visual support |
| Scaling behavior | Partial | Capacity controls exist; simulation is basic |
| Workload and request simulation | Planned | HTTP, events, queues, records, and writes |

## Security And Governance

| Capability | Status | Notes |
| --- | --- | --- |
| Route, SG, and NACL flow controls | Current | Edge-level controls |
| IAM posture selection | Current | High-level least privilege/broad/none |
| Firewall simulation | Current | High-level allow/deny mode |
| Public exposure checks | Current | Security assessment warnings |
| Encryption checks | Current | Data-store findings |
| IAM statement evaluator | Planned | Actions, resources, principals, conditions |
| Resource policies | Planned | S3, SQS, SNS, KMS, Lambda, and more |
| Explicit deny precedence | Planned | Central policy evaluation |
| SCPs and permission boundaries | Planned | Multi-account learning |
| Protocol/port security rules | Planned | Stateful SG and stateless NACL rules |
| Failure injection | Planned | Denied IAM, AZ failure, bad route, expired secret |

## Cost And Billing

| Capability | Status | Notes |
| --- | --- | --- |
| Per-resource estimate | Current | Educational baseline |
| Editable workload assumptions | Current | Hours, requests, storage, transfer |
| EC2/EBS/snapshot estimate | Current | Configuration-aware approximation |
| Lambda, RDS, S3, NAT, edge estimates | Current | Simplified pricing models |
| Region-specific pricing | Planned | Provider pricing adapter |
| Free tier and discounts | Planned | Explicit assumption profiles |
| Cost allocation tags | Planned | Chargeback and ownership learning |
| Daily/monthly scenario views | Planned | Budget and trend learning |
| AWS Pricing Calculator parity | Planned | Separate from educational estimate |

## Learning And Outputs

| Capability | Status | Notes |
| --- | --- | --- |
| Scenario prompt and requirements | Current/Partial | First scenario foundation exists |
| Rule-based architecture grading | Partial | Early rule engine foundation |
| Domain scoring | Planned | Security, reliability, performance, cost |
| Adaptive scenarios | Planned | Difficulty based on learner history |
| AI customer role-play | Planned | Requirements conversation and clarification |
| AWS CLI generation | Planned | Explainable commands |
| Terraform modules | Planned | Reusable provider-specific modules |
| CloudFormation/CDK examples | Planned | Additional AWS outputs |
| Visual-to-IaC diff | Planned | Compare architecture and generated code |
| Import architecture from IaC | Planned | Reverse mapping |

## Provider Expansion

| Capability | Status | Notes |
| --- | --- | --- |
| Provider-aware registry | Current | AWS active, future providers disabled |
| Provider-neutral graph concepts | Partial | Graph and learner state are reusable |
| AWS service adapter | Current | Catalogue, rules, icons, pricing seed |
| Azure adapter | Planned | VNet, NSG, Entra ID, VM, Functions |
| GCP adapter | Planned | VPC, firewall rules, IAM, Compute Engine |
| Cross-provider comparison | Planned | Equivalent architecture decisions |
