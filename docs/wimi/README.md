# WIMI KIDS — frontend foundation and mock-first flow

These documents describe the current WIMI frontend slice in the Taxi
repository. The mock-first booking flow is not production-ready and does not
prove that the backend contract is ready.

## Work items

- [WIMI-001 — Baseline and reuse map](WIMI-001-baseline.md)
- [WIMI-002 — Two build modes](WIMI-002-build-modes.md)
- [WIMI-003 — Backend readiness and integration blockers](WIMI-003-backend-readiness.md)
- [WIMI-004 — Mock-first nanny booking UI](https://github.com/Gh0st0fwAr/taxi/pull/3)
- [WIMI-005 — Booking flow hardening and regression tests](WIMI-005-booking-flow-hardening.md)

## Current scope

- One repository and one React/TypeScript/Webpack toolchain.
- Existing Taxi build remains the default and outputs to `taxi/build/`.
- WIMI build outputs to `taxi/build-wimi/`.
- WIMI has a booking form, review step and local demo result.
- Demo orders exist only in page memory. There are no real order submissions,
  nanny assignments, payment processing or notifications.
- No changes to Platform Core or Taxi business flows are intended.
- WIMI-005 hardens the existing mock flow and its regression coverage; it does
  not implement the backend.
- WIMI-003 remains the integration-readiness audit and release-blocker list.
  Production integration must not be enabled until its blockers are resolved.

## Historical foundation verification

The original WIMI-001–003 validation on source commit `157c359` passed:
- `npm ci` on Node.js 24;
- `npm run build:taxi`;
- `npm run build:wimi`;
- Jest: 51 suites and 397 tests passed.

The build emitted existing Sass/CSS compatibility and Browserslist freshness
warnings; they were retained in logs but did not fail compilation. The build
artifacts were uploaded by
[GitHub Actions run 38091354959](https://github.com/Gh0st0fwAr/taxi/actions/runs/38091354959).

The original E2E attempt for the foundation failed before business scenarios
could execute because dedicated test-account secrets were not configured at
that time. That historical result does not describe the current E2E status;
check the relevant GitHub Actions run for the SHA being evaluated.

These checks validate only the code and scenarios actually run. They do not
certify production readiness of the nanny UX or backend contract.
