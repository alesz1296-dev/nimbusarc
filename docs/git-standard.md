# NimbusArc Git Standard

This standard is immutable unless changed through an approved documentation pull request.

## Project Scope

NimbusArc is a visual cloud learning platform focused first on AWS Solutions Architect Associate preparation.

Current priorities:

- visual architecture learning
- scenario-based feedback
- service catalogue and documentation links
- clean separation between UI, domain logic, data, and integrations

Future priorities:

- Terraform examples
- CLI learning flows
- LocalStack labs
- Azure and other providers through a shared provider model

Code and git practices must preserve this evolution path.

## Spec Driven Development

NimbusArc follows lightweight Spec Driven Development with phase gates.

Required sequence for meaningful features:

1. Define or update the feature spec
2. Clarify user flow and acceptance criteria
3. Plan implementation scope
4. Break work into tasks
5. Implement
6. Review
7. Update docs

Required artifacts depend on scope:

- `docs/specs/<feature>/spec.md` for new features
- `docs/specs/<feature>/plan.md` for multi-step work
- `docs/tasks.md` for active work tracking
- `docs/research.md` when evaluating AWS services, Terraform patterns, CLI workflows, LocalStack behavior, or provider-specific tradeoffs
- `docs/data-model.md` when changing persisted progress, scenarios, or catalogue structure
- `docs/contracts/` when adding export formats, IaC generators, or API boundaries later
- `docs/quickstart.md` for validation scenarios when a feature changes learner workflows

Specs are the source of truth. Code must implement the spec, not replace it.

## Architecture Boundary Rule

NimbusArc must preserve clear boundaries:

- `src/ui`: visual primitives and presentation-only components
- `src/features`: user workflows and feature composition
- `src/domain`: rules, types, engines, scoring logic, scenario evaluation
- `src/data`: provider data, services, scenarios, seed content
- `src/integrations`: Terraform, CLI, LocalStack, persistence, AI, and external adapters

Rules:

- Do not place scoring logic in UI components.
- Do not place provider-specific logic directly in shared domain code unless behind a provider abstraction.
- Do not couple AWS-first decisions so tightly that Azure or GCP becomes a rewrite later.
- UI refactors must not silently change rule-engine behavior.
- Domain and scoring changes require tests before merge.

## UI Change Safety

- Prefer small UI branches that change one workflow or surface at a time.
- Shared components must stay presentation-focused and avoid embedding scoring, scenario, or provider logic.
- Feature components may orchestrate state, but domain rules must live outside the UI layer.
- Visual changes to canvas, palette, feedback, and catalogue should be testable independently.
- New UI elements should be composable, replaceable, and not tightly tied to AWS-specific data shapes when a shared abstraction is practical.

## Frequent Validation Rule

- Run the app locally for any feature that changes layout, interaction, or learning flow.
- Validate desktop and mobile views for every major UI change.
- Check for overflow, overlap, dead controls, broken empty states, and visual regressions.
- For canvas or interaction changes, verify add, move, connect, reset, and feedback flows manually before commit.
- Prefer lightweight component or workflow tests when a UI behavior is likely to regress.

## Visual QA Checklist

Use this checklist before review on visual or interaction changes:

- Canvas renders without clipping or blank states.
- Service palette items are readable, aligned, and selectable.
- Scenario panel content wraps cleanly on desktop and mobile.
- Feedback states remain legible for pass, fail, and mixed outcomes.
- Catalogue cards or rows do not overflow with long service names.
- Buttons, toggles, and future node controls have visible states.
- No overlapping text, panels, or controls at common breakpoints.

## Loose Coupling Rule

- UI components should receive data and callbacks, not import business rules directly.
- Scenario evaluation should depend on a graph or domain model, not a React component state shape.
- AWS service metadata should be injectable from provider data, not hardcoded into shared components.
- Terraform, CLI, and LocalStack support should plug into integration boundaries, not feature components.
- Future Azure or GCP support must be addable through provider modules, not canvas rewrites.

## Branch Rules

Never work directly on `main`.

Create a dedicated branch for every feature, fix, refactor, documentation change, or chore.

Allowed branch prefixes:

- `feat/`
- `fix/`
- `refactor/`
- `docs/`
- `chore/`
- `research/`

Examples:

- `feat/scenario-evaluator`
- `feat/aws-service-catalogue`
- `fix/canvas-node-selection`
- `refactor/provider-registry`
- `docs/mvp-roadmap`
- `chore/ci-baseline`

## Keep Local Repository Updated

Before starting work:

```powershell
git pull
git status
```

## Review Changes Before Staging

Always inspect changes before staging:

```powershell
git status
git diff
```

## Stage Files Explicitly

Preferred:

```powershell
git add src/domain/rules.ts docs/tasks.md
```

Avoid:

```powershell
git add .
```

Use `git add .` only when every changed file has been reviewed and is intentionally part of the same logical change.

## Verify Staged Changes

Before committing:

```powershell
git status
git diff --staged
```

## Commit Messages

Use Conventional Commits.

Allowed types:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`

Examples:

- `feat: add first scenario scoring engine`
- `fix: correct service palette selection state`
- `refactor: separate provider registry from scenario data`
- `docs: add mvp roadmap for aws saa`
- `chore: add build check to ci`

Avoid vague commits:

- `update`
- `changes`
- `wip`
- `misc`
- `fix stuff`

## Commit Scope Rule

One commit should represent one logical change.

Do not combine these unless they are inseparable:

- UI redesign
- scenario data changes
- rule engine changes
- Terraform generation work
- docs-only work
- CI changes

## Push and Pull Request Rules

All changes must reach `main` through a pull request.

Do not merge directly into `main`.

Push only after explicit approval:

```powershell
git push -u origin <branch-name>
```

Pull request requirements:

- build passes
- tests required by the feature pass
- scope is focused
- description explains purpose and impact
- docs are updated when needed
- reviewer confirms architecture boundaries were respected

## CI Standard

CI starts with the current reality of the project.

Phase 0 and Phase 1 minimum CI:

- `npm run build`

As the project grows, CI should add:

- unit tests for rule evaluation and scoring
- component tests for learning workflows
- scenario regression tests
- Terraform validation when Terraform examples are introduced
- LocalStack validation scripts when emulation is introduced

Pull requests must not merge when required CI checks fail.

## Testing Standard

Tests scale with risk.

Required expectations:

- UI-only style or layout changes: verify build passes
- scenario data changes: add or update scenario validation tests
- scoring or rule-engine changes: add unit tests
- provider abstraction changes: add compatibility tests
- CLI, Terraform, or LocalStack generation changes: add artifact validation tests

No scoring logic should be changed without tests.

## Documentation Standard

The following docs should stay current:

- roadmap and phase status
- active tasks
- scenario coverage
- supported services
- provider support status
- integration status for Terraform, CLI, LocalStack, and future adapters

When a feature changes user behavior, learning flow, or architecture boundaries, update docs in the same branch.

## Learning Integrity Rules

NimbusArc is a learning platform, not a fake deployment generator.

Rules:

- feedback must explain architectural reasoning
- scores must be based on explicit rules, not hidden heuristics
- exam explanations must not invent AWS behavior
- catalogue content must trace to official docs or approved learning references
- learner-facing guidance must distinguish recommendation from requirement
- future AI assistance must explain, not silently decide

## Provider Extension Rules

AWS is first, not permanent-only.

Rules:

- shared abstractions must use provider-neutral naming when practical
- provider-specific services stay in provider-owned data files
- adding Azure or GCP must not require rewriting shared canvas, scoring pipeline, or feedback model
- certification tracks must remain extensible beyond `aws-saa`

## Infrastructure and Cost Rules

NimbusArc must remain low-cost by default.

Rules:

- no automatic cloud deployment by default
- no automatic Terraform apply
- no automatic AWS resource creation
- LocalStack and local workflows are the default safe practice path
- expensive cloud examples must be documented as optional and cost-aware
- generated IaC examples must be reviewable before any real use

## Security Rules

Never commit:

- `.env`
- `.env.local`
- cloud credentials
- AWS access keys
- Terraform state files containing secrets
- private config files
- generated secrets or certificates

Always review staged files for accidental secrets before commit.

## Restricted Git Actions

The following actions require explicit approval:

- `git commit`
- `git push`
- `git merge`
- `git rebase`
- `git reset`
- `git branch -d`
- `git tag`

Every git write operation must be explained before execution.
