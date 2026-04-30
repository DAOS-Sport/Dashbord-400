# PR-2: Telemetry DB-backed + Correlation ID

## Files Changed
- `server/modules/telemetry/repository.ts` - added `createPostgresTelemetryRepository(db)` for `ui_events`, `client_errors`, and `audit_logs`; factory now returns memory only for mock profiles and Postgres otherwise.
- `server/modules/telemetry/routes.ts` - merges `correlationId` from request body or `x-correlation-id` for UI events, client errors, and the matching audit event.
- `client/src/shared/telemetry/correlation.ts` - added tab-scoped session correlation id helpers using `sessionStorage`.
- `client/src/shared/telemetry/useTrackEvent.ts` - sends `correlationId` for explicit UI telemetry and telemetry dispatch failure reports.
- `client/src/App.tsx` - sends `correlationId` from the global widget click capture path without changing capture behavior.
- `scripts/module-smoke.ts` - added a guard that `createPostgresTelemetryRepository` must exist.
- `server/shared/telemetry/audit-writer.ts` - removed unused reserved writer exports; retained `AuditEventInput` as the repository input contract.

## Verification
- type-check: pass
- check: pass
- smoke:modules: pass (new rule "createPostgresTelemetryRepository must exist" effective)
- check:modules: pass (telemetry-audit status unchanged)
- full Phase 0 closeout rerun: pass

## Out of Scope Findings
- `shared/schema.ts` has no standalone `client_errors.correlation_id` column. This PR preserves client error correlation id inside `client_errors.metadata.correlationId`; adding a physical column is a schema/migration decision outside PR-2.
- Domain write audit caller coverage was completed after the first PR-2 pass; Replit still needs live DB row verification.

## Notes for Reviewer
- `ui_events.payload` and `audit_logs.payload` receive `{}` when payload is `undefined`; object payloads are passed through directly. Non-object payloads are wrapped as `{ value }` so the jsonb columns always receive an object.
- `client_errors.metadata` is the only jsonb field on that table, so `componentId` and `correlationId` are stored there while the fixed table columns stay aligned to `shared/schema.ts`.
- Telemetry writes catch and log failures with `[telemetry:<table>:write_failed]` and do not throw. This follows v2.3 §15.7: monitoring data must not block the primary user flow.
- Correlation id uses `window.sessionStorage`, so it is stable within a browser tab/session and resets when that tab session ends. `resetCorrelationId()` is exported but not wired to logout in this PR.
