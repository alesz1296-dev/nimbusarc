# NimbusArc Technical Architecture

## Layer Model

```text
App shell
  owns workspace state, panel visibility, and composition

Features
  canvas, catalogue, scenarios, analysis, feedback, learning workflows

Domain
  graph, commands, rules, flow simulation, security assessment, cost estimation

Data
  provider registries, service catalogue, scenarios, pricing profiles, rule packs

UI
  reusable panels, controls, icons, status indicators, design tokens

Integrations
  future AWS CLI, Terraform, LocalStack, documentation, persistence, and AI adapters
```

## Current Source Of Truth

The `ArchitectureGraph` is the source of truth for the visual architecture. It contains:

- `zones`: region, VPC, Availability Zone, subnet, and related scopes
- `nodes`: placed services and service-specific configuration
- `edges`: directional relationships and flow controls

Learner selection, scenario status, simulation snapshots, and attempts belong to learner state around the graph rather than inside visual components.

## Provider Boundary

The provider-neutral layer should own:

- graph topology
- zones and containment concepts
- node and edge identity
- learner actions
- simulation result shape
- findings and scoring shape
- cost estimate shape

Provider adapters should own:

- service catalogue entries
- icon mapping
- connection rules
- configuration schemas
- network semantics
- IAM/policy semantics
- pricing profiles
- IaC and CLI generation
- official documentation references

## Feature Boundaries

Canvas rendering should not calculate pricing or evaluate IAM. The intended boundaries are:

- `ArchitectureCanvasPreview`: render and capture interaction intent
- `graphCommands`: pure graph mutations
- `flowSimulation`: flow outcomes
- `securitySimulation`: security findings and path decisions
- `costEstimator`: cost assumptions and estimates
- provider data: services, rules, scenarios, and pricing seeds
- analysis UI: present domain results and collect user assumptions

## Planned Persistence Contract

The first persistence implementation should serialize a versioned workspace:

```text
Workspace
  schemaVersion
  provider
  activeScenarioId
  graph
  learnerState
  costAssumptions
  securityProfile
  createdAt / updatedAt
```

Local browser persistence should come first. A server-backed store can later add accounts, sharing, history, and instructor review without changing the graph contract.

## Simulation Contract

Simulations should remain deterministic when given the same graph, configuration, workload, and failure-injection seed. Each result should expose:

- status
- affected resource or edge
- reason
- supporting rule or policy reference
- learner-facing explanation

This enables the same result to drive canvas animation, feedback, logs, scoring, and future replay.
