# NimbusArc Quickstart

## Current App Commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Visual QA Flow

Use this flow for interface-heavy work:

1. Start the app with `npm.cmd run dev`.
2. Open the local app in a desktop viewport and verify the app shell loads.
3. Resize to a mobile viewport and confirm navigation, palette, feedback, and catalogue remain readable.
4. For canvas work, verify add, move, connect, reset, and empty-state behavior.
5. For scenario work, verify requirements render clearly and feedback reflects the learner action state.
6. Run `npm.cmd run build` before requesting review.

## First Implementation Targets

- interactive architecture graph state
- scenario submit and retry loop
- rule evaluation engine outside the UI layer
- expanded AWS SAA catalogue coverage
- regression checks for core learner flows
