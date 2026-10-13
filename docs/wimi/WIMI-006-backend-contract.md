# WIMI-006 — Secure backend contract for booking

**Status:** specification only; no backend endpoint or production integration is implemented by this document.  
**Depends on:** WIMI-003 readiness blockers and WIMI-005 mock-first booking flow.  
**Target:** define the verifiable contract required before the WIMI browser may create a real booking.

## 1. Goal

Replace assumptions about the legacy `nanny_pricing` template with an explicit, tested contract between the WIMI UI and a server-authorized booking API. The server remains the only authority for eligibility, price, order creation, finalization and receipt data.

WIMI must remain mock-only until the blocking acceptance criteria in this specification are met. This task does not authorize enabling real bookings.

## 2. Non-goals

- Do not expose MultiBot administrator `token/hash` in browser code, bundles, source maps, requests or client logs.
- Do not call an administrative `nanny_pricing` template directly from the browser.
- Do not implement payment processing; cash is paid directly to the nanny outside the service.
- Do not change Taxi order lifecycle, Taxi pricing, Platform Core, the shared router, or the default Taxi build.
- Do not add a second WIMI frontend or a new state-management framework.
- Do not claim production readiness from mock tests or a successful frontend build.

## 3. Contract discovery gate

Before implementation, record evidence from the deployed backend and its source revision for all of the following:

1. Canonical deployed API URL and routing path.
2. Authentication model for a regular customer and authorization checks for each operation.
3. Request and response schema, including required, optional and nullable fields.
4. Meaning and validation of the legacy `b_passengers_count` field. Do not map child count to hours or any other unrelated field.
5. Representation of service address/location, children count and ages, requested start, duration, extras, breaks and end time.
6. Quote, create, retry, cancellation, completion and receipt semantics.
7. Error status/code mapping and which errors are safe to retry.
8. Database transaction and uniqueness guarantees for idempotency.
9. The deployed timezone library and server-side midnight-finalization mechanism.

Unknown values remain explicitly **UNKNOWN**. Do not infer a production DTO from field names alone. If evidence cannot be obtained, keep the integration blocked and report the exact missing evidence.

## 4. Proposed logical operations

These are logical operations, not approved URL paths. Exact paths and payloads must be taken from verified backend evidence before implementation.

### 4.1 Quote

Input: normalized booking details needed to calculate eligibility and price.

Output must identify the quote, currency, base amount in integer minor units, billed duration, tariff version/rule and any separately itemized extras. The quote is informational and may expire or become invalid when inputs or server state change.

The client may display a quote but must not treat it as authoritative for final billing.

### 4.2 Create booking

Input: the normalized booking details, a client-generated idempotency key, and only the user-authorized data required by the verified contract.

Output: stable booking ID, canonical server status, accepted booking details, authoritative quote/final amount where applicable, and timestamps with unambiguous timezone semantics.

A timeout does not mean the booking failed. Retry with the same idempotency key and same normalized payload; never silently mint a new key to recover from an unknown outcome.

### 4.3 Read booking result

A retriable create must be recoverable by the same key or a verified read operation. The client must distinguish:
- confirmed creation;
- confirmed rejection before creation;
- outcome unknown because the response was lost;
- a conflicting reuse of the same idempotency key.

Do not display a successful booking state until the server confirms it.

### 4.4 Completion and receipt

Server-side completion must stop time accrual at the agreed cutoff, persist the final amount and an auditable billing breakdown, and issue the receipt according to the existing business requirements. Frontend timers must not determine the final amount or close the authoritative order.

## 5. Canonical billing contract

The following rules are required for all quote, create and finalization paths:

- Rate: **€2.50 per started 10-minute block** (€15 per hour).
- Billable duration is rounded **up** to the next 10-minute boundary.
- Minimum booking duration: 120 minutes.
- Minimum base amount: €30.
- Service working window: 06:00–24:00 local time at the service location.
- New bookings must start no later than 22:00 and must fit the minimum duration before midnight; a 22:00 start is therefore invalid.
- At 00:00 local service time, the server closes the active order, stops accrual and creates the receipt/final amount.
- Store monetary amounts as integer minor units; do not use binary floating-point arithmetic for persisted totals.
- Additional services, if enabled later, must be separate auditable line items and must not silently alter the base tariff.

Required base-price examples before extras:

| Actual duration | Billed duration | Base amount |
|---:|---:|---:|
| 120 min | 120 min (minimum) | €30.00 |
| 121 min | 130 min | €32.50 |
| 129 min | 130 min | €32.50 |
| 130 min | 130 min | €32.50 |
| 131 min | 140 min | €35.00 |
| 149 min | 150 min | €37.50 |
| 150 min | 150 min | €37.50 |
| 151 min | 160 min | €40.00 |
| 179 min | 180 min | €45.00 |
| 180 min | 180 min | €45.00 |

The UI mock adapter must remain aligned with these examples. The server contract and server tests are the authority for production billing.

## 6. Idempotency and concurrency

The server must enforce all of these conditions atomically:

1. Same key + same normalized payload returns the original booking/result.
2. Same key + materially different normalized payload returns a documented conflict.
3. Concurrent requests with the same key create exactly one booking.
4. A retry after a timeout or lost response recovers the original outcome.
5. Idempotency lookup happens early enough that a legitimate retry is not rejected merely because the first request already occupied the requested time.
6. Key scope, retention/expiry and behavior after expiry are documented and tested.
7. The database enforces the uniqueness guarantee; an in-memory frontend guard is not a substitute.

## 7. Security and transport

- Use a same-origin backend-for-frontend (BFF) or a dedicated user-authorized endpoint, subject to the existing deployment architecture.
- Administrative credentials remain server-side and must never be embedded in `REACT_APP_*` configuration.
- Verify authentication and authorization on every operation; never rely on hidden UI controls.
- Validate and normalize all request fields server-side.
- Avoid logging addresses, children’s ages, tokens, hashes, or other unnecessary personal data.
- If cross-origin access is unavoidable, explicitly test OPTIONS preflight, allowed origins, methods, headers and credential behavior.
- Do not include secrets or real personal data in automated tests, fixtures, screenshots or CI artifacts.

## 8. Timezone and DST

- Resolve the service location to a verified IANA timezone on the server; do not blindly trust a browser-supplied timezone.
- Carry an unambiguous instant at the transport boundary and retain the service-location timezone for interpretation and display.
- Define what happens for nonexistent or ambiguous local times during DST changes.
- Test Europe/Madrid winter/summer transitions and verify that the 00:00 close and 22:00 acceptance boundary are evaluated in service-local time.
- Browser-local time is not a valid substitute for service-location time.

## 9. Error contract

Provide stable machine-readable error codes and a human-readable message safe for the customer. At minimum distinguish:

- validation error;
- unauthenticated / unauthorized;
- quote expired or changed;
- time slot unavailable;
- idempotency-key conflict;
- confirmed create failure;
- outcome unknown / retry required;
- server failure.

The UI must not expose raw stack traces, database errors, credentials or internal template details. Only retry when the contract says retry is safe, and reuse the same idempotency key when recovering an uncertain create.

## 10. Required verification

### Contract tests

- Schema validation for valid, missing, malformed and unexpected fields.
- Customer authorization and attempts to use administrative credentials.
- All tariff boundaries in §5.
- Same-key same-payload retry returns one stable booking.
- Same-key changed-payload conflict.
- Concurrent duplicate creates create one booking.
- Simulated lost response followed by same-key retry recovers the original booking.
- Quote changes or expires when relevant input or server state changes.
- Timezone, DST, 22:00 cutoff and midnight finalization.
- Receipt and final amount persist with a traceable billing breakdown.
- No admin secret appears in browser bundles, source maps, network traffic or client logs.
- Existing Taxi passenger/driver and order-lifecycle regression tests pass.

### Frontend tests

- Mock mode remains the default until an explicit, reviewed release gate is satisfied.
- A failed or unknown create result is never presented as a confirmed booking.
- Retry reuses the same idempotency key and normalized payload.
- Quote and booking details shown in review match the latest edited draft.
- No direct browser request is made to an administrative template.
- Taxi and WIMI build modes remain isolated.

## 11. Acceptance gates

Implementation may begin only after the contract discovery gate (§3) is backed by evidence. Real booking integration may be enabled only when:

- every blocking item in WIMI-003 B1–B7 has an owner and verified resolution;
- request/response DTOs and error codes are documented from the deployed implementation;
- server-side billing, timezone, idempotency and finalization tests pass;
- frontend contract tests and existing Taxi regression tests pass;
- a security check confirms no administrator credentials reach the browser;
- a release review explicitly authorizes switching from mock to real API.

Until all gates pass, WIMI remains demo-only. A green frontend CI run does not waive any gate.
