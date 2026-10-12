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

GitHub Actions validation on source commit `157c359` passed:
- `npm ci` on Node.js 24;
- `npm run build:taxi`;
- `npm run build:wimi`;
- Jest: 51 suites and 397 tests passed.

The build emitted existing Sass/CSS compatibility and Browserslist freshness
warnings; they were retained in logs but not treated as compilation errors.
The build artifacts were uploaded by
[GitHub Actions run 38091354959](https://github.com/Gh0st0fwAr/taxi/actions/runs/38091354959).

Playwright was attempted separately, but the run failed before business scenarios
could execute because the repository has no configured `E2E_DRIVER_LOGIN`,
`E2E_DRIVER_PASSWORD`, `E2E_PASSENGER_LOGIN` and related test-account secrets.
Configure dedicated test accounts as described in [e2e/README.md](../../taxi/e2e/README.md)
and rerun the E2E workflow before treating Playwright as passed.

These checks validate the build foundation, not production readiness of the
nanny UX or backend contract.
