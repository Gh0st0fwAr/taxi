# WIMI-003 — Backend readiness and web integration blockers

## Verdict

Do not connect the WIMI browser directly to the administrative
`nanny_pricing` template. Backend remains the sole authority for pricing,
order creation, billing and finalization. This work item documents blockers;
it does not implement or certify backend readiness.

## Observed integration shape

- Universal API routing is under `public_html/taxi/`; the older root-level
  application is not the canonical path for this integration.
- `public_html/taxi/controllers/c_api.php` routes API calls, including
  `drive`; `public_html/taxi/models/api.php` contains the large API model.
- MultiBot's `APIManager.pricingTemplate()` calls
  `POST ${baseUrl}/script/template/nanny_pricing` with `is_var`,
  `s_t_data` (JSON-encoded payload), administrator `token/hash`, and an
  optional id field. The deployed canonical URL still must be confirmed.
- Order creation carries `request_key` and `time_zone`. Existing payload
  semantics need a verified DTO before the frontend can rely on them.
- Existing backend evidence does not yet establish that `completeOrder()`
  enforces all WIMI billing and midnight-finalization rules.

## Blocking requirements

### B1 — Keep administrator credentials server-side
Expose a same-origin BFF or a dedicated user-authorized endpoint. Never ship
MultiBot administrator `token/hash` to browser JavaScript, source maps,
network requests or client logs.

### B2 — Server-authoritative quote and final amount
The server must validate tariff, duration, options and eligibility. A client
quote is only a preview. Persist the final amount and a clear billing breakdown.

### B3 — Idempotent order creation
- Same key + same normalized payload returns the same order/result.
- Same key + materially different payload returns a conflict.
- Concurrent creates with the same key create exactly one order.
- After a timeout or lost response, retry with the same key; do not silently
  generate a new key.
- Find the prior request before validations that would reject a legitimate
  retry because a resource is already occupied.
- Decide explicitly whether keys expire; a 24-hour duplicate window alone is
  not a complete business contract.

A separate Universal Backend idempotency effort was reported as passing 18
isolated tests in a previous stand run. That result does not prove this
specific `nanny_pricing` flow is correct; verify the deployed commit and run
contract tests against the target endpoint.

### B4 — WIMI billing and finalization
Server-side rules to enforce:
- nanny working window: 06:00–24:00;
- new orders accepted until 22:00;
- at 00:00, auto-close the order, stop accrual and issue the receipt;
- bill each started 10-minute block in full, rounding duration up to the next 10-minute boundary;
- €2.50 per billed block (€15/hour);
- minimum duration 120 minutes, minimum amount €30;
- store the final amount and an auditable billing breakdown.

Required boundary cases before extras: 120 minutes = €30 minimum; 121 and 129 minutes round up to 130 billed minutes = €32.50; 130 minutes = €32.50; 131 minutes rounds up to 140 billed minutes = €35; 149 and 150 minutes round up/remain at 150 billed minutes = €37.50; 151 minutes rounds up to 160 billed minutes = €40; 179 and 180 minutes bill as 180 minutes = €45. Any started 10-minute block is charged in full.

### B5 — Timezone and DST
- Use the IANA timezone for the service location.
- Validate timezone against coordinates on the server; do not blindly trust
  a client-supplied `time_zone`.
- Store an unambiguous instant at the transport boundary and display local
  service-location time in the UI.
- Test Europe/Madrid winter/summer transitions on the order date.

### B6 — CORS and preflight
If cross-origin browser access is planned, verify OPTIONS preflight, allowed
methods/headers and credentials. Prefer a same-origin BFF to avoid exposing
admin auth and reduce CORS complexity.

### B7 — Confirm the order contract
Before finalizing frontend DTOs, verify:
- deployed canonical URL and request/response schema for `nanny_pricing`;
- meaning of `b_passengers_count` (the observed fallback
  `childrenCount ?? hoursCount ?? 1` mixes unrelated concepts);
- children, extras, breaks and end-time representation;
- errors, authorization and quote/create/final response semantics.

## Required pre-release tests

1. Quote changes when any relevant input changes.
2. Double-click create creates one order.
3. Lost response retry returns the original order with the same key.
4. Same key with changed payload conflicts.
5. Concurrent create requests create one order.
6. Distinguish failure before create from failure after successful create.
7. Billing: minimum, round-up of every started 10-minute block and boundary cases.
8. Midnight auto-close stops accrual and issues receipt.
9. Acceptance cutoff at 22:00.
10. Europe/Madrid DST transitions.
11. Taxi order lifecycle has no regression.
12. No administrator credential appears in client bundles, source maps,
    browser network traffic or client logs.

## Readiness decision

Until B1–B7 and contract tests are verified, WIMI web may be developed against
a mock adapter, but real order creation must remain disabled. This is an audit
and release gate, not evidence that the backend fixes have already shipped.
