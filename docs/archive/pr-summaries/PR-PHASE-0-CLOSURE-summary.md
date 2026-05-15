# Phase 0 Closure Batch Summary

## Sub-task Status

- Sub-task 1 (domain writes audit): ✅
- Sub-task 2 (tasks create helper): ✅
- Sub-task 3 (handover_entries): ✅ / partial
- Sub-task 4 (anomaly_reports): ✅
- Sub-task 5 (notification_recipients): ✅
- Sub-task 6 (smoke rule): ✅

## Files Changed

### Sub-task 1: domain writes audit

- `server/app/http/register-routes.ts`
  - `registerNewArchitectureRoutes()` returns the existing app container for legacy route audit wiring.
- `server/routes.ts`
  - Added audit calls after successful quick link, employee resource, operational handover, and system announcement writes.
- `server/modules/tasks/index.ts`
  - Added task update/status audit calls.

### Sub-task 2: tasks create helper

- `server/shared/data/write-metadata.ts`
  - Added `withTaskCreateMetadata()` for task-specific create metadata fields.
- `server/modules/tasks/index.ts`
  - Task create uses `withTaskCreateMetadata()`.
  - Task create writes `TASK_CREATED`.

### Sub-task 3: handover_entries

- `server/routes.ts`
  - Legacy `POST /api/portal/handovers` writes `HANDOVER_ENTRY_CREATED`.
  - No update endpoint exists for `handover_entries`; update audit is skipped.

### Sub-task 4: anomaly_reports

- `server/routes.ts`
  - `POST /api/anomaly-report` writes `ANOMALY_REPORTED`.
  - Single resolve writes `ANOMALY_RESOLVED`.
  - Batch resolve writes `ANOMALY_RESOLVED`.

### Sub-task 5: notification_recipients

- `server/routes.ts`
  - Create writes `NOTIFICATION_RECIPIENT_CREATED`.
  - Update writes `NOTIFICATION_RECIPIENT_UPDATED`.
  - Delete writes `NOTIFICATION_RECIPIENT_DELETED` with the requested deleted email/name snapshot.

### Sub-task 6: smoke rule

- `scripts/module-smoke.ts`
  - Added route-block audit action checks for all Phase 0 closure write paths.
  - Updated anomaly actor metadata smoke checks to match the explicit `actor` variable.

### Documentation

- `docs/audits/audit-log-write-verification.md`
- `docs/PHASE_TOPOLOGY_MAP.md`
- `docs/CONSTRUCTION_MAP.md`
- `PR-2-summary.md`
- `PR-T0.1.5-summary.md`
- `PR-T0.1.6-summary.md`

## Verification

- type-check: pass
- check: pass
- smoke:modules: pass
- check:modules: pass

## Audit Coverage Map

| Action | file:line |
|---|---|
| `ANOMALY_REPORTED` | `server/routes.ts:403` |
| `ANOMALY_RESOLVED` | `server/routes.ts:511` |
| `ANOMALY_RESOLVED` | `server/routes.ts:542` |
| `NOTIFICATION_RECIPIENT_CREATED` | `server/routes.ts:636` |
| `NOTIFICATION_RECIPIENT_UPDATED` | `server/routes.ts:668` |
| `NOTIFICATION_RECIPIENT_DELETED` | `server/routes.ts:693` |
| `HANDOVER_ENTRY_CREATED` | `server/routes.ts:1152` |
| `OPERATIONAL_HANDOVER_CREATED` | `server/routes.ts:1304` |
| `OPERATIONAL_HANDOVER_UPDATED` | `server/routes.ts:1359` |
| `OPERATIONAL_HANDOVER_REPORTED` | `server/routes.ts:1402` |
| `QUICK_LINK_CREATED` | `server/routes.ts:1537` |
| `QUICK_LINK_UPDATED` | `server/routes.ts:1579` |
| `EMPLOYEE_RESOURCE_CREATED` | `server/routes.ts:1649` |
| `EMPLOYEE_RESOURCE_UPDATED` | `server/routes.ts:1705` |
| `SYSTEM_ANNOUNCEMENT_CREATED` | `server/routes.ts:1774` |
| `SYSTEM_ANNOUNCEMENT_UPDATED` | `server/routes.ts:1804` |
| `TASK_CREATED` | `server/modules/tasks/index.ts:134` |
| `TASK_UPDATED` | `server/modules/tasks/index.ts:167` |
| `TASK_STATUS_UPDATED` | `server/modules/tasks/index.ts:204` |

## Skipped Items

- `HANDOVER_ENTRY_UPDATED`: skipped because no `handover_entries` update endpoint exists.
- `check:training-flow`: skipped because it requires Replit/session environment.

## Halt Decisions

None.

## Out of Scope Findings

- Replit live DB verification remains required. Local checks prove routing/typing/smoke only.
- `client_errors.correlation_id` is still stored as `client_errors.metadata.correlationId`; adding a physical column remains a future schema decision.
- Telemetry public endpoint auth hardening remains ADR PR-3 scope.

## Replit Acceptance Steps (for human)

1. Confirm non-mock env:

```txt
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<set>
```

2. Trigger writes:

- create a quick link
- create an employee resource
- create an operational handover
- create a system announcement
- create a task
- create a handover entry if the legacy portal path is still active
- create/update/delete a notification recipient
- create/resolve an anomaly report

3. Query:

```sql
SELECT action, COUNT(*), MAX(timestamp)
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY action
ORDER BY MAX(timestamp) DESC;
```

Expected: corresponding Phase 0 closure actions appear with at least one row each after manual triggering.
