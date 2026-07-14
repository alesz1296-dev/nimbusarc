# NimbusArc Task Tracker

Keep active work current so implementation, review, and visual QA remain visible between sessions.

## Status Legend

- `Planned`
- `In progress`
- `In review`
- `Blocked`
- `Complete`

## Active Work Packets

| ID | Phase | Work Packet | Owner | Reviewer | Status | Tests Required | Docs Impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NA-001 | Phase 0 | Establish project standards and working docs spine | Ale | Reviewer TBD | In review | `npm run build` not required for docs-only change | `README.md`, `docs/git-standard.md`, `docs/tasks.md`, `docs/logs.md`, `docs/changes.md`, `docs/quickstart.md`, `docs/research.md`, `docs/data-model.md` |
| NA-002 | Phase 1 | Define domain architecture graph model | Ale | Reviewer TBD | In review | Build plus graph model type checks | Spec, task tracker, data model |
| NA-003 | Phase 1 | Add graph command helpers for learner edits | Ale | Reviewer TBD | In review | Build plus unit tests for add, move, connect, delete, reset | Spec, task tracker, data model |
| NA-004 | Phase 1 | Render canvas from domain graph state | Ale | Reviewer TBD | In review | Build plus desktop and mobile visual QA | Quickstart visual QA notes, data model |
| NA-005 | Phase 1 | Make service palette add nodes to the canvas | Ale | Reviewer TBD | In review | Build plus manual add-node validation | Quickstart visual QA notes, data model |
| NA-006 | Phase 1 | Support node selection, movement, deletion, and reset | Ale | Reviewer TBD | In review | Build plus manual canvas interaction validation | Quickstart visual QA notes, data model |
| NA-007 | Phase 1 | Support learner-created connections between services | Ale | Reviewer TBD | In progress | Build plus graph edge tests and manual connect validation | Quickstart visual QA notes, data model |
| NA-008 | Phase 1 | Add first scenario submission flow | Ale | Reviewer TBD | Planned | Build plus scenario state tests | Scenario spec, quickstart |
| NA-009 | Phase 1 | Implement rule evaluator for the first AWS SAA scenario | Ale | Reviewer TBD | Planned | Unit tests for required service, connection, and zone rules | Scenario spec, supported rule docs |
| NA-010 | Phase 1 | Replace static feedback preview with evaluated feedback states | Ale | Reviewer TBD | Planned | Build plus manual pass, fail, mixed feedback validation | Quickstart visual QA notes |
| NA-011 | Phase 1 | Expand AWS SAA service catalogue for MVP scenarios | Ale | Reviewer TBD | Planned | Build plus catalogue data validation checks | Supported services docs |
| NA-012 | Phase 1 | Add Phase 1 visual regression checklist and scenario acceptance notes | Ale | Reviewer TBD | Planned | Docs review plus build if code changed | `docs/quickstart.md`, scenario spec |
| NA-013 | Phase 2 | Introduce CI baseline and first automated checks | Ale | Reviewer TBD | Planned | `npm run build` and initial test command | README, git standard |
| NA-014 | Phase 2 | Persist architecture workspaces locally | Ale | Reviewer TBD | Planned | Build plus save/load and reload validation | Product map, architecture, data model |
| NA-015 | Phase 2 | Add undo/redo command history | Ale | Reviewer TBD | Planned | Graph command tests plus manual interaction validation | Product map, architecture |
| NA-016 | Phase 3 | Model route tables, CIDR validation, and route propagation | Ale | Reviewer TBD | Planned | Domain tests for valid and invalid paths | Feature map, security model |
| NA-017 | Phase 3 | Implement protocol/port security-group and NACL rules | Ale | Reviewer TBD | Planned | Policy and path evaluation tests | Feature map, security model |
| NA-018 | Phase 3 | Implement IAM statement and explicit-deny evaluation | Ale | Reviewer TBD | Planned | Policy evaluator unit tests | Feature map, security model |
| NA-019 | Phase 4 | Add resource lifecycle and failure-injection simulation | Ale | Reviewer TBD | Planned | Deterministic simulation tests and visual QA | Roadmap, architecture |
| NA-020 | Phase 5 | Expand regional pricing and cost assumptions | Ale | Reviewer TBD | Planned | Cost fixture tests and assumption audit | Feature map, security-cost model |
| NA-021 | Phase 6 | Generate AWS CLI and Terraform artifacts | Ale | Reviewer TBD | Planned | Generated artifact validation | Roadmap, architecture |
| NA-022 | Phase 7 | Define provider adapter contract for Azure expansion | Ale | Reviewer TBD | Planned | Contract tests with AWS adapter | Product map, architecture |

## Phase 1 Goal

Phase 1 delivers the first playable NimbusArc learning loop: choose or view an AWS SAA scenario, add services to an architecture canvas, connect them, submit the design, and receive evaluated feedback.

## Phase 1 Acceptance Criteria

- The canvas renders from a domain-owned `ArchitectureGraph`, not hardcoded preview data.
- Learner actions can add, move, connect, delete, and reset graph items.
- Scenario state tracks the active scenario, graph, attempts, selected item, submission status, and latest result.
- The first evaluator can score required services, required connections, and required zone placement.
- Feedback distinguishes passed, failed, and not-yet-checked rules.
- The first AWS SAA scenario is playable end to end without AWS costs.
- Visual QA passes on desktop and mobile for canvas, palette, scenario panel, feedback, and catalogue.

## Phase 1 Suggested Implementation Order

1. `NA-002`: define graph and learner state types.
2. `NA-003`: add pure graph command helpers.
3. `NA-004`: render the current preview from graph data.
4. `NA-005`: connect palette actions to node creation.
5. `NA-006`: add movement, selection, deletion, and reset.
6. `NA-007`: add service connections.
7. `NA-008`: introduce submit and retry scenario state.
8. `NA-009`: evaluate rules against the graph.
9. `NA-010`: show real feedback states.
10. `NA-011`: expand AWS service data.
11. `NA-012`: complete visual QA and acceptance notes.

## Notes

- Do not mark a packet `Complete` until review is finished.
- Move merged but unapproved work to `In review`.
- Split packets when UI, domain, or integration scope becomes too broad.
- Keep Phase 1 branches small because canvas, feedback, and graph behavior will change quickly.
