# PR-T0.1.5: Domain Writes recordAudit Wiring

## Files Changed

- `server/app/http/register-routes.ts`
  - `registerNewArchitectureRoutes()` now returns the existing app container so legacy routes can reuse the same telemetry repository.
- `server/routes.ts`
  - Added `recordAudit()` after successful writes for:
    - `OPERATIONAL_HANDOVER_CREATED`
    - `OPERATIONAL_HANDOVER_UPDATED`
    - `OPERATIONAL_HANDOVER_REPORTED`
    - `QUICK_LINK_CREATED`
    - `QUICK_LINK_UPDATED`
    - `EMPLOYEE_RESOURCE_CREATED`
    - `EMPLOYEE_RESOURCE_UPDATED`
    - `SYSTEM_ANNOUNCEMENT_CREATED`
    - `SYSTEM_ANNOUNCEMENT_UPDATED`
- `server/modules/tasks/index.ts`
  - Added `recordAudit()` after task update and task status update:
    - `TASK_UPDATED`
    - `TASK_STATUS_UPDATED`
- `scripts/module-smoke.ts`
  - Added smoke checks that each target route block contains `recordAudit()` and the expected audit action.
- `docs/PHASE_TOPOLOGY_MAP.md`
  - Added T0.1.5 audit wiring to Phase 0 topology and exit criteria.
- `docs/CONSTRUCTION_MAP.md`
  - Added T0.1/T0.1.5 progress notes and Replit audit row verification reminder.

## Verification

- type-check: pass
- check: pass
- smoke:modules: pass
- check:modules: pass

## What's NOT Changed

- `tasks` create at `server/modules/tasks/index.ts` remains out of scope for T0.1.5.
- `server/shared/telemetry/audit-writer.ts` reserved writer remains out of scope.
- telemetry repository implementation remains unchanged.
- schema and metadata helpers remain unchanged.
- telemetry public endpoint auth hardening remains out of scope.

## Smoke Rule Details

`scripts/module-smoke.ts` now extracts each target Express route block and requires:

- `recordAudit({`
- the expected `action: "..."`

This covers the 9 legacy route write blocks in `server/routes.ts` and the 2 task update blocks in `server/modules/tasks/index.ts`.

## Halt Reason

None.
