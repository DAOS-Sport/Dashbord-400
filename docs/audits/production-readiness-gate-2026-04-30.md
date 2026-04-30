# Production Readiness Gate Audit

Date: 2026-04-30
Scope: Dreams CMS / Modular Monolith + Module Registry + BFF + Role-based Dashboard

## Executive Status

| Gate | Status | Notes |
|---|---|---|
| Gate 0: Environment / baseline | PASS with path warning | Toolchain checks pass locally. Root `CONSTRUCTION_MAP.md` and `MODULE_COMPLETION_MATRIX.md` are missing, but `docs/CONSTRUCTION_MAP.md` and `docs/MODULE_COMPLETION_MATRIX.md` exist and were used. |
| Gate 1: DB migration / real data smoke | REPLIT-ONLY | Local environment is mock/no `DATABASE_URL`; per owner instruction, real DB CRUD and audit row checks are deferred to Replit deployment. |
| Gate 2: Employee convergence | DEPLOYMENT-TEST-READY | Static/build gates pass; daily-use status requires Replit data smoke and viewport browser pass. |
| Gate 3: Supervisor real data acceptance | DEPLOYMENT-TEST-READY | UI/API wiring is present for core pages; final pass requires Replit DB smoke for tasks, announcements, handover, anomaly, training. |
| Gate 4: System / IT hard gates | PARTIAL / NOT OPEN | System health and DB-backed telemetry wiring exist, but Raw Inspector and system debug registry still need SYSTEM_ADMIN hard guard and server-side audit policy. |
| Gate 5: BFF / Registry / Navigation | PASS with gaps | Registry checks pass. No-BFF modules remain: `portal-manage`, `gmail-integration`, `file-upload-export`, `legacy-users`, `user-role-snapshots`, `widget-layout-settings`. |
| Gate 6: Documentation | UPDATED | Current counts and readiness boundaries were updated in construction docs. |

## Required Documents

| Required path | Result |
|---|---|
| `docs/PHASE_TOPOLOGY_MAP.md` | FOUND |
| `docs/PHASE_ACCEPTANCE_GATES.md` | FOUND |
| `docs/SKILL_ASSISTED_CONSTRUCTION_ROUTER.md` | FOUND |
| `docs/UIUX_SKILL_REVIEW_PROTOCOL.md` | FOUND |
| `CONSTRUCTION_MAP.md` | MISSING at repo root; `docs/CONSTRUCTION_MAP.md` exists |
| `MODULE_COMPLETION_MATRIX.md` | MISSING at repo root; `docs/MODULE_COMPLETION_MATRIX.md` exists |

## Gate 0: Environment And Baseline

### Dirty File Classification

Source code:

- `client/src/App.tsx`
- `client/src/index.css`
- `client/src/modules/employee/home/api.ts`
- `client/src/modules/employee/home/employee-home-page.tsx`
- `client/src/modules/supervisor/announcements/api.ts`
- `client/src/modules/supervisor/announcements/page.tsx`
- `client/src/modules/supervisor/anomalies/page.tsx`
- `client/src/modules/supervisor/dashboard-page.tsx`
- `client/src/modules/supervisor/handover/api.ts`
- `client/src/modules/supervisor/handover/page.tsx`
- `client/src/modules/supervisor/people/page.tsx`
- `client/src/modules/supervisor/reports/api.ts`
- `client/src/modules/supervisor/reports/page.tsx`
- `client/src/modules/supervisor/settings/api.ts` deleted
- `client/src/modules/supervisor/settings/page.tsx` deleted
- `client/src/modules/supervisor/tasks/page.tsx`
- `client/src/modules/supervisor/training/page.tsx`
- `client/src/modules/workbench/role-shell.tsx`
- `client/src/types/portal.ts`
- `scripts/module-smoke.ts`
- `server/modules/bff/routes.ts`
- `server/routes.ts`
- `server/storage.ts`
- `shared/modules/registry.ts`
- `shared/schema.ts`
- `client/src/modules/employee/qna/` new
- `client/src/modules/supervisor/supervisor-ui.tsx` new

Docs:

- `docs/CONSTRUCTION_MAP.md`
- `docs/MODULE_COMPLETION_MATRIX.md`
- `docs/PHASE_TOPOLOGY_MAP.md`
- `docs/frontend-experience-architecture.md`
- `docs/workbench-implementation-plan.md`
- `docs/CURRENT_PROGRESS_AND_REMAINING_PLAN.md` new
- `docs/IT_SYSTEM_EXECUTION_BLUEPRINT.md` new
- `docs/REPLIT_CLOSURE_EXECUTION_BOOK.md` new
- `docs/audits/production-readiness-gate-2026-04-30.md` new

Migrations:

- `migrations/0005_knowledge_base_qna.sql` new
- `migrations/0006_supervisor_announcement_controls.sql` new

Generated/screenshots:

- none detected in `git status -s`

### Script Results

| Command | Result | Notes |
|---|---|---|
| `npm run type-check` | PASS | 0 TypeScript errors |
| `npm run smoke:modules` | PASS | descriptors: 51; employee navigation: 7; supervisor navigation: 22; system navigation: 18 |
| `npm run check` | PASS | Type-check wrapper passed |
| `npm run check:modules` | PASS | total: 43; implemented: 10; partial: 23; planned: 3; legacy: 4; external: 2; mock: 0; deprecated: 1 |
| `npm run build` | PASS with warnings | Browserslist stale, PostCSS missing `from`, large chunks |
| lint | NOT RUN | No lint script was identified in package scripts during this gate. |

Tooling note: local `rg.exe` returned Windows access denied from the bundled app path during this run. PowerShell `Get-ChildItem` + `Select-String` was used as fallback.

## Gate 1: DB Migration And Real Data Smoke

Status: REPLIT-ONLY.

Reason: the local environment is mock/no `DATABASE_URL`, and owner explicitly directed that DB data testing will be handled after Replit deployment. No local DB write result is counted as production evidence.

Required Replit migrations:

- `migrations/0004_employee_resource_event_metadata.sql`
- `migrations/0005_knowledge_base_qna.sql`
- `migrations/0006_supervisor_announcement_controls.sql`

Required Replit data smoke:

| Flow | Tables | Required evidence |
|---|---|---|
| employee resources document/event/sticky_note/training | `employee_resources` | row exists, metadata fields, audit action |
| Q&A CRUD/search | `knowledge_base_qna` | create/answer/edit/delete-or-archive/search |
| announcements publish/type/pinned/active/publishAt/expireAt | `system_announcements` | employee BFF can read supervisor-published item |
| tasks lifecycle | `tasks` | supervisor create/assign, employee read/done, supervisor observes state |
| handover lifecycle | `operational_handovers`, `handover_entries` | employee create, supervisor read, reply, read/complete |
| anomaly reports | `anomaly_reports` | create, resolve, reopen/batch if available |
| notification recipients | `notification_recipients` | create/update/delete |
| telemetry/audit | `ui_events`, `client_errors`, `audit_logs` | corresponding rows with actor/role/facility/source/correlation |

## Gate 2: Employee Convergence

Status: DEPLOYMENT-TEST-READY, not production-ready.

Local evidence:

- Employee navigation remains 7 entries in smoke output.
- Employee home BFF and UI modules compile.
- Q&A route/module exists under `client/src/modules/employee/qna/`.
- Employee announcement BFF merge path exists so supervisor-published `system_announcements` are included even when projection data exists.

Remaining before production-ready:

- Replit DB smoke for `employee_resources`, `knowledge_base_qna`, `system_announcements`, `tasks`, `operational_handovers`.
- Browser viewport pass at 390px, 768px, 1440px.
- External schedule/weather/checkin sources must stay `not_connected` / `degraded` until real providers are configured.

## Gate 3: Supervisor Real Data Acceptance

Status: DEPLOYMENT-TEST-READY, not production-ready.

Local evidence:

- `/api/bff/supervisor/dashboard` is protected by `requireRole("supervisor", "system")`.
- Supervisor settings route/files are deleted and should not be reintroduced.
- Supervisor modules compile: dashboard, facilities/people, tasks, announcements, handover, anomalies, reports, training.
- Facility cards route into `/supervisor/facilities/:facilityKey`.
- Announcements UI/API compile with `0006_supervisor_announcement_controls.sql` present.

Remaining before production-ready:

- Replit DB smoke for task lifecycle, announcement lifecycle, handover lifecycle, anomaly lifecycle, training resource lifecycle.
- Verify employee side receives newly published supervisor announcements in Replit DB mode.
- Viewport pass for 390px, 768px, 1440px.
- Confirm authorized facility filtering against real Ragic/session data.

## Gate 4: System / IT Hard Gates

Status: PARTIAL / NOT OPEN.

Evidence:

- System health overview exists at `/api/bff/system/health-overview`.
- Integration overview exists at `/api/bff/system/integration-overview`.
- Telemetry repository has `createPostgresTelemetryRepository` and factory switches to Postgres outside mock profile.
- Raw Inspector client uses a whitelist of target endpoints and emits telemetry before query.

Blocking gaps:

- `/api/system/module-registry`, `/api/system/module-registry/:id`, `/api/system/module-registry-role/:role` still include a TODO/warning for SYSTEM_ADMIN restriction and are not hardened.
- Raw Inspector is a client-side whitelist plus telemetry event, not a server-side SYSTEM_ADMIN-only audited raw query service.
- `GET /api/telemetry/module-events` and related overview endpoints are not enough to claim full OpenTelemetry traces/metrics/logs.
- `integration_error_logs`, `sync_job_runs`, and `bff_latency_logs` are still planned/partial in registry coverage.

Decision: System / IT can be used by developers for deployment diagnostics only. Do not open as a production governance console until SYSTEM_ADMIN hard guard, query audit, and raw query policy are complete.

## Gate 5: BFF / Registry / Navigation

Status: PASS with known gaps.

Registry check result:

- total: 43
- implemented: 10
- partial: 23
- planned: 3
- legacy: 4
- external: 2
- mock: 0
- deprecated: 1

Modules without BFF binding:

- `portal-manage`
- `gmail-integration`
- `file-upload-export`
- `legacy-users`
- `user-role-snapshots`
- `widget-layout-settings`

These modules must remain hidden, background-only, legacy, external, or clearly marked not-connected until BFF/API/role policy exists.

## Gate 6: Documentation Updates

Updated:

- `docs/CONSTRUCTION_MAP.md`: current counts, no-BFF modules, DB readiness boundary, System/IT guard warning.
- `docs/MODULE_COMPLETION_MATRIX.md`: current telemetry/raw-inspector/module-registry status and blockers.
- `docs/audits/production-readiness-gate-2026-04-30.md`: this gate report.

## Deployment Decision

| Question | Answer |
|---|---|
| Can deploy to Replit for DB smoke? | YES |
| Can call it production-ready now? | NO |
| Can give employees a controlled trial after Replit DB smoke? | YES, if Gate 1 and viewport checks pass |
| Can give supervisors a controlled trial after Replit DB smoke? | YES, if Gate 1 and supervisor flows pass |
| Can open System / IT governance console broadly? | NO |

## Next Required Replit Acceptance

1. Apply migrations `0004`, `0005`, `0006`.
2. Set real env: `DATABASE_URL`, non-mock `DATABASE_PROFILE`, non-mock `DATA_SOURCE_MODE`, Ragic/Schedule secrets as applicable.
3. Run the Gate 1 DB smoke checklist.
4. Query `audit_logs` for all write actions touched by employee/supervisor flows.
5. Verify employee receives supervisor-published announcements through `/api/bff/employee/home`.
6. Run viewport checks for employee and supervisor at 390px, 768px, 1440px.
7. Keep System / IT console restricted until the Gate 4 blockers are fixed.
