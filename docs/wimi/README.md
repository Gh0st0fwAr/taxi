# WIMI KIDS — frontend foundation

These documents describe the first implementation slice for WIMI in the Taxi
repository. They do not claim that the nanny user experience or backend
contract is production-ready.

## Work items

- [WIMI-001 — Baseline and reuse map](WIMI-001-baseline.md)
- [WIMI-002 — Two build modes](WIMI-002-build-modes.md)
- [WIMI-003 — Backend readiness](WIMI-003-backend-readiness.md)

## Current scope

- One repository and one React/TypeScript/Webpack toolchain.
- Existing Taxi build remains the default and outputs to `taxi/build/`.
- WIMI build outputs to `taxi/build-wimi/`.
- No changes to Platform Core and no WIMI-specific business flow in this slice.
- No backend implementation is included; WIMI-003 is an integration-readiness
  audit and a list of release blockers.

## Verification status

The GitHub API changes are being prepared on branch
`feat/wimi-001-003-foundation`. A local dependency-installed build and the
full test suites have not been run in this environment. Do not treat this
branch as production-ready until CI and the acceptance checks in WIMI-002 pass.
