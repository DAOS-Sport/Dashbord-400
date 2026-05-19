# Module Closure Matrix

Date: 2026-05-19

Purpose: give future agents one closure contract for module work. A module is not closed just because a page renders or local type-check passes. It must have an explicit lifecycle state, owner role, source of truth, route/API status, data/migration status, verification evidence, and remaining production blocker.

## Closure States

| State | Meaning |
| --- | --- |
| `closed` | Code, registry, docs, tests, deployment data, and external/provider proof are aligned. |
| `local-ready` | Local code and deterministic gates pass; deployment or provider proof is still pending. |
| `deploy-pending` | Needs Replit/Neon migration, secret, cookie, or real provider validation. |
| `blocked` | A required owner surface, source of truth, or verification path is missing. |
| `retired` | UI/API/registry ownership is intentionally removed; only deployment cleanup or historical docs may remain. |

## Current Closure Batch

| Module / Surface | Lifecycle | Owner | Source of truth | Route/API status | Data/migration status | Verification evidence | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tasks` | `retired` / `deploy-pending` | Retired from employee/supervisor workbench; operational work now belongs to `handover`, `counter-log`, and work-log modules. | Historical `tasks` table only until deployment cleanup. | `/employee/tasks`, `/supervisor/tasks`, and `server/modules/tasks` removed from current worktree. | `migrations/0014_retire_tasks_personal_note.sql` drops `tasks`; `scripts/post-merge.sh` runs `scripts/apply-db-retirement-migrations.cjs`. | `npm run dry-run` passed after route/module removal. | Replit/Neon must run post-merge with `NEON_DATABASE_URL` or `DATABASE_URL`, then confirm `tasks` table is gone. |
| `personal-note` / `sticky_note` | `retired` / `deploy-pending` | Retired from employee workbench. Employee resources remain for documents/events/training. | Historical `employee_resources.category='sticky_note'` rows only until deployment cleanup. | `/employee/personal-note` removed; employee home no longer renders sticky-note row. | `0014_retire_tasks_personal_note.sql` deletes `employee_resources` rows where `category='sticky_note'`. | `npm run dry-run` passed after route/module removal. | Replit/Neon must confirm no `sticky_note` rows remain and no current UI path recreates them. |
| `linebot-management` whitelist comparison | `local-ready` | System / IT | 400LINE authority + CMS shadow whitelist + Ragic employee cache. | `/api/bff/system/linebot-management/whitelist-comparison` remains system-only. | No migration in this batch. | `npm run smoke:linebot-management` passed on 2026-05-19 for contract and legacy fallback mode. | Keep the smoke harness aligned with the production app container, including `services.ragicCache`. |
| `employee-training` | `deploy-pending` | Employee / Supervisor / System | `employee_resources category=training` + `TRAINING_VIEW` telemetry. | Employee reader, supervisor management, and system report are wired. | Existing migration path, but real row proof is external. | Local dry-run passes; `npm run check:training-flow` requires deployment cookies. | Run `check:training-flow` with employee/system cookies in Replit; do not mark closed from local mock mode. |
| Announcement BFF policy | `deploy-pending` | Supervisor owns publish/review; Employee consumes. | `system_announcements`, LINE candidates, group broadcasts, and overlay state. | Local gates pass, but policy is still split across BFF and legacy/proxy paths. | Existing migrations require production proof. | `npm run check:announcement-classifier` passed locally. | Follow-up BFF policy pass and production row checks are still required. |

## Closure Checklist

Use this checklist for every future module before calling it closed:

1. Registry lifecycle is honest: `implemented`, `partial`, `legacy`, `deprecated`, or retired.
2. Owner role is explicit; visibility does not imply ownership.
3. UI route, BFF/API endpoint, service/repository, schema/migration, and docs agree.
4. Empty, error, degraded, and `not_connected` states are either implemented or listed in cleanup backlog.
5. Local deterministic gate passes: at minimum `npm run check`, `npm run check:modules`, `npm run smoke:modules`, and relevant focused smoke.
6. Deployment gate is named when local cannot prove it: Replit/Neon DB rows, real provider response, or cookie-authenticated flow.
7. Retired modules have a migration/cleanup path and are not listed as active product surfaces in current planning docs.
