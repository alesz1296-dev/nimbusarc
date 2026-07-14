# NimbusArc Data Model Notes

Use this file to record meaningful changes to persisted or shareable structures.

Candidates for documentation:

- architecture graph types
- learner scenario state
- rule evaluation result shapes
- service catalogue schema
- progress tracking and attempt history
- generated Terraform or CLI artifact shapes

## Template

### YYYY-MM-DD - Model Change

- Area:
- Previous shape:
- New shape:
- Why:
- Migration or compatibility notes:

## Entries

### 2026-07-13 - Architecture graph foundation

- Area: Phase 1 learner architecture model.
- Previous shape: Domain types covered providers, services, rules, and scenarios only.
- New shape: Added `ArchitectureGraph`, `ArchitectureZone`, `ArchitectureNode`, `ArchitectureEdge`, `GraphSelection`, and `LearnerScenarioState`, plus a factory for empty scenario graphs.
- Why: Phase 1 needs a domain-owned source of truth before the canvas, evaluator, and feedback can become interactive.
- Migration or compatibility notes: Existing preview components are still hardcoded for now. `NA-004` will switch the canvas to consume this model.

### 2026-07-13 - Graph command helpers

- Area: Phase 1 learner edit behavior.
- Previous shape: Graph data existed, but domain-level mutations were not defined.
- New shape: Added pure command helpers for `addNode`, `moveNode`, `assignNodeToZone`, `updateNodeConfig`, `connectNodes`, `removeNode`, `removeEdge`, `resetGraph`, selection updates, and `updateScenarioGraph`.
- Why: The future canvas and scenario workflows need domain-owned edit behavior instead of embedding architecture mutations inside React components.
- Migration or compatibility notes: UI components still need to adopt these helpers in `NA-004` and later packets. Invalid edits currently no-op, which keeps the command layer predictable for first integration.

### 2026-07-13 - Domain-backed canvas preview

- Area: Phase 1 canvas rendering.
- Previous shape: The canvas preview used a local hardcoded node array and fixed zone labels inside the component.
- New shape: Added preview graph factories for AWS scenarios and switched the canvas preview to render zones and nodes from `ArchitectureGraph`.
- Why: The Phase 1 UI needs to depend on domain state before learner edits, evaluation, and feedback can share one source of truth.
- Migration or compatibility notes: The canvas is still read-only for now. `NA-005` and `NA-006` will connect user interactions to the command helpers and scenario state.

### 2026-07-13 - Palette-driven graph creation

- Area: Phase 1 learner interaction flow.
- Previous shape: The app shell rendered a domain-backed preview graph, but the palette could not mutate it.
- New shape: The app shell now owns learner scenario state and uses `addNode` through `updateScenarioGraph` when the service palette is clicked. Initial node placement is suggested from service-aware zone mapping plus predictable slot positions.
- Why: Phase 1 needs the first tactile interaction so the canvas stops being a read-only preview and becomes the start of a usable learning surface.
- Migration or compatibility notes: Placement is intentionally simple and will likely evolve during `NA-006` and later drag-and-drop work. Graph mutation still stays in the domain layer.

### 2026-07-13 - Selection and manipulation controls

- Area: Phase 1 canvas interaction model.
- Previous shape: Learners could add nodes, but they could not meaningfully manipulate or remove them.
- New shape: The app shell now tracks the selected node and exposes handlers for selection clearing, node movement, deletion, and graph reset. The canvas renders selected-state styling and toolbar controls for directional movement and destructive actions.
- Why: The first playable NimbusArc loop needs direct, visible control over the architecture once services are on the board.
- Migration or compatibility notes: Movement currently uses button-driven nudging with clamped coordinates. Drag behavior and edge creation will extend this interaction model in later tasks.

### 2026-07-13 - Edge creation flow

- Area: Phase 1 graph relationship model.
- Previous shape: Nodes could be placed and manipulated, but the architecture had no visible or editable service-to-service connections in the UI.
- New shape: The app shell now supports a connect mode that uses the selected node as a source and connects it to the next clicked target node through `connectNodes`. The canvas renders graph edges as SVG lines and exposes connect status in the toolbar and canvas metadata.
- Why: Architecture learning depends on relationships between services, not just service placement.
- Migration or compatibility notes: Connections are currently created as directed request edges with a simple click flow. Edge selection, deletion, and richer connection semantics can extend this later without replacing the graph model.
