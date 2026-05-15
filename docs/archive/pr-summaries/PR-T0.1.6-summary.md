# PR-T0.1.6: Task Create Metadata + Audit Closeout

## Files Changed

- `server/shared/data/write-metadata.ts`
  - Added `withTaskCreateMetadata()` for the task schema's non-standard create metadata fields.
- `server/modules/tasks/index.ts`
  - Task create now uses `withTaskCreateMetadata()`.
  - Task create now writes `TASK_CREATED` audit after successful persistence.
- `server/shared/telemetry/audit-writer.ts`
  - Removed unused reserved writer exports and kept `AuditEventInput`.
- `scripts/module-smoke.ts`
  - Added checks for `withTaskCreateMetadata()`.
  - Added `TASK_CREATED` audit smoke rule.
- `docs/PHASE_TOPOLOGY_MAP.md`
  - Phase 0 notes updated after verification.
- `docs/CONSTRUCTION_MAP.md`
  - Phase 0 progress updated after verification.

## Verification

- type-check: pass
- check: pass
- smoke:modules: pass
- check:modules: pass
- build: pass

## Notes for Reviewer

- `tasks` uses `created_by_user_id` / `created_by_name` instead of the generic `created_by`, so a dedicated helper was added instead of forcing the generic helper.
- `TASK_CREATED` is emitted only after `storage.createTask()` succeeds.
- Audit write failure remains non-blocking through the telemetry repository try/catch.

## Questions / Follow-up Log

- Replit live verification still needs to query `audit_logs` after creating/updating a task and other domain rows.
- `client_errors.correlation_id` remains in `metadata.correlationId`; adding a physical column is a future schema decision.

## Halt Reason

None.
