# WIMI-001 — Baseline and reuse map

**Repository:** `Gh0st0fwAr/taxi` (fork of `Guseyn9/taxi`)  
**Baseline reviewed:** `main`, 2026-10-10  
**Scope:** frontend architecture and reusable infrastructure; no nanny UX yet.

## 1. Baseline

| Area | Observed baseline | WIMI decision |
|---|---|---|
| Runtime | React / React DOM 19 | Reuse the existing runtime |
| Language | TypeScript 5.7; strict mode configured | Keep strict typing; do not weaken compiler settings |
| Build | Webpack 5; custom CRA-like `scripts/build.js` and `scripts/start.js` | Extend the current pipeline; do not replace the bundler |
| Routing | React Router 6; route registry under Platform Interface | Keep one router infrastructure and select route composition by app mode in a later step |
| UI | MUI 6 and existing shared components | Reuse neutral controls and patterns, not Taxi-specific ride forms as nanny UX |
| State | Redux 5 / React Redux 9 | Do not add a second global store without a concrete need |
| Platform Interface | `src/platform/platform-interface/` | Preserve PI → Surface → Channel boundary |
| Interaction Contract | `src/platform/interaction-contract/api.ts`: `dispatch`, `subscribe`, `snapshot` | Add nanny-domain actions separately; do not rename Taxi actions |
| Environment | `config/env.js` injects `REACT_APP_*` variables | Only public configuration may be exposed to the browser; never place secrets here |
| Build output | `config/paths.js` originally points to `build/` | WIMI must use an isolated output directory |
| Tests | Jest and Playwright scripts exist | CI must verify both builds and prevent Taxi regressions |

## 2. Key files

- `taxi/package.json` — dependencies, Node 24 engine, build/start/test scripts.
- `taxi/config/webpack.config.js` — webpack configuration factory.
- `taxi/config/paths.js` — output directory and app paths.
- `taxi/config/env.js` — dotenv loading and public environment injection.
- `taxi/public/index.html` — currently Taxi-specific HTML metadata.
- `taxi/src/Routes.tsx` — current Taxi route composition.
- `taxi/src/platform/platform-interface/navigation/routes.ts` and
  `NavigationRegistry.ts` — navigation registry.
- `taxi/src/platform/interaction-contract/api.ts` — interaction contract.
- `taxi/src/siteConstants.ts` — existing Taxi site constants.

## 3. Reuse map

### Reuse as shared infrastructure
- Webpack, TypeScript, lint/test setup and build scripts.
- MUI primitives, generic form controls, loading and notification patterns.
- NavigationRegistry and the Platform Interface abstractions.
- Date/time utilities only after testing service-location timezone and DST.

### Reuse only behind a boundary
- API transport and auth: WIMI must use user-scoped authorization or a
  server-side BFF. Do not reuse MultiBot administrator credentials in a browser.
- Site constants: create mode-specific configuration; do not blindly inherit
  Taxi branding, assets or defaults.
- Shared state: keep domain-specific actions and entities separate.

### Do not reuse as nanny business logic
- Driver/passenger route flows and Taxi ride lifecycle.
- Taxi pricing, surge coefficients, driver selection and ride-specific statuses.
- Historical `drive` field names without an explicit, tested WIMI DTO mapping.

## 4. Baseline verification still required

Run in a clean checkout with Node 24 and installed dependencies:

1. `npm run build:nix` on the baseline.
2. `npm run test:nix`.
3. Existing Playwright suite.
4. Smoke tests for passenger/driver routes, auth and Taxi order lifecycle.
5. Record warnings, errors and bundle sizes.

These baseline commands were not run during the remote repository audit. This
document records inspected repository structure, not a claim that CI passed.
