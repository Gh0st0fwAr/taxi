# WIMI-002 — Two build modes in one codebase

## Goal

Produce Taxi and WIMI frontend artifacts from one repository without one build
overwriting the other. Taxi remains the default for backward compatibility.

## Implemented in this branch

- `npm run build:taxi` — sets `BUILD_MODE=taxi` and outputs to `taxi/build/`.
- `npm run build:wimi` — sets `BUILD_MODE=wimi` and outputs to `taxi/build-wimi/`.
- `REACT_APP_BUILD_MODE` exposes the selected, non-secret mode to client code.
- Both commands invoke the existing `pre-build.js` and `scripts/build.js`
  pipeline; no replacement bundler or duplicate frontend was introduced.
- Existing `build`, `build:default`, and `build:nix` scripts are preserved.
- An unknown mode exits with code 2 and an explanatory message.

## Architecture decisions

The mode switch is deliberately limited to build configuration. It does not
add widespread `if (isWimi)` branches, change routes, introduce nanny
business logic, alter Platform Core, or change API URLs. Route composition,
WIMI-specific screens, theme/metadata and the nanny API adapter belong in
subsequent isolated modules.

## Acceptance checks

Run from `taxi/` with Node 24 and dependencies installed:

1. `npm run build:taxi` succeeds and creates `build/`.
2. `npm run build:wimi` succeeds and creates `build-wimi/`.
3. Run both commands in either order; each output directory remains intact
   after the other build.
4. Run `node scripts/build-mode.js invalid`; it exits non-zero and does not
   start a build.
5. Jest and the existing Playwright suite are checked separately.
6. Confirm no Taxi route, API, auth or order lifecycle regression.

## Verification results

On source commit `157c359`, GitHub Actions completed both production builds
successfully:
- Taxi: `npm run build:taxi`;
- WIMI: `npm run build:wimi`.

Jest passed: 51 suites, 397 tests. The workflow uploaded both build directories
as an artifact. Existing Sass/CSS compatibility and Browserslist warnings remain
visible in the build logs; CI does not promote these existing warnings to errors.

Playwright has **not passed**: its workflow failed at authentication setup
because dedicated test-account secrets were not configured. No business
scenarios ran. Set up the required accounts/secrets from `taxi/e2e/README.md`
and rerun E2E before marking the full acceptance suite green.

The build/test result validates this code snapshot; it does not establish
production readiness of the WIMI screens or backend integration.
