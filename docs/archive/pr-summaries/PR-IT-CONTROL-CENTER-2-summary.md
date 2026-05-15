# PR-IT-CONTROL-CENTER-2 Summary

## Sub-task Status

- IT2.0 Control-center severity: DONE
  - Operations tile now uses recent `OPS_ASSIST_*` pending rows and completed IT assist counts.
  - Insights tile now uses 7-day anomaly detection from telemetry aggregation.
- IT2.1 Operations BFF endpoints: DONE / PARTIAL
  - Implemented user search, user detail, reset-session, refresh-cache, resend-notification, recent-assists.
  - `reason` is required for interventions and system-role targets are rejected.
  - Reset session deletes `sessions_index` rows only. Current runtime session authority remains the in-memory session store, so this is an audited data-layer intervention until auth/session-store exposes an invalidation hook.
  - Resend notification returns `no_notification_system` because there is no `failed_notifications` table/system in this batch.
- IT2.2 Operations UI: DONE
  - Replaced placeholder with compact Ops Console: search, user snapshot, tabs, intervention dialog, recent assists.
- IT2.3 Insights BFF endpoints: DONE
  - Implemented overview and module drill-down endpoints over `ui_events` and `audit_logs`.
  - Added 5-minute in-memory aggregation cache and completion-event bindings.
- IT2.4 Insights UI: DONE
  - Replaced placeholder with compact insights dashboard, period toggle, anomalies, top modules, role/facility summaries, module detail sheet, SVG sparkline.
- IT2.5 Navigation / registry: DONE
  - `system-operations` and `system-insights` are marked implemented and registered with BFF endpoints and telemetry events.
- IT2.6 Smoke / Unit test: DONE
  - Added IT-2 endpoint guard, intervention, anomaly, and completion-rate checks to module unit tests.

## Files Changed

- `server/modules/system/routes.ts`
  - Added control-center operations/insights severity wiring.
  - Added operations endpoints.
  - Added insights aggregation endpoints.
- `server/modules/telemetry/repository.ts`
  - Added `listUiEvents` and `listClientErrors` for memory and Postgres telemetry repositories.
- `server/shared/telemetry/audit-writer.ts`
  - Allows `pending` audit result status for queued/pending operations assist rows.
- `shared/modules/insights-events.ts`
  - New shared completion/anomaly helper definitions.
- `shared/modules/index.ts`
  - Exports insights event helpers.
- `shared/modules/registry.ts`
  - Marks operations/insights implemented and registers APIs/telemetry.
- `shared/modules/descriptors.ts`
  - Updates system operations/insights descriptor BFF endpoints and telemetry events.
- `client/src/modules/system/control-center/page.tsx`
  - Displays real operations/insights tile summaries with tighter density.
- `client/src/modules/system/operations/page.tsx`
  - Full Ops Console UI.
- `client/src/modules/system/insights/page.tsx`
  - Full Insights UI.
- `scripts/module-unit-tests.ts`
  - Adds IT-2 contract tests.

## New BFF Endpoints

- `GET /api/bff/system/operations/user-search?q=`
- `GET /api/bff/system/operations/user/:userId`
- `POST /api/bff/system/operations/user/:userId/reset-session`
- `POST /api/bff/system/operations/user/:userId/refresh-cache`
- `POST /api/bff/system/operations/user/:userId/resend-notification`
- `GET /api/bff/system/operations/recent-assists?limit=50`
- `GET /api/bff/system/insights/overview?period=7d|30d`
- `GET /api/bff/system/insights/module/:moduleId?period=7d|30d`

## Audit Actions Added

- `OPS_ASSIST_RESET_SESSION`
- `OPS_RESET_SESSION`
- `OPS_ASSIST_REFRESH_CACHE`
- `OPS_REFRESH_CACHE`
- `OPS_ASSIST_RESEND_NOTIFICATION`
- `OPS_RESEND_NOTIFICATION`

## Verification

- `npm run type-check`: PASS
- `npm run check`: PASS
- `npm run check:modules`: PASS
- `npm run smoke:modules`: PASS
- `npm run unit:modules`: PASS
- `npm run dry-run`: PASS
- Browser smoke:
  - `/system`: PASS, control-center shows operations/insights tiles.
  - `/system/operations`: PASS, compact Ops Console renders.
  - `/system/insights`: PASS, insights dashboard renders.

## Halt Decisions

- No full-batch halt.
- Reset-session is partial because current auth runtime uses memory sessions and this task forbids changing auth/session-store.
- Resend-notification is partial because there is no notification retry backend/table in the current schema.

## Out of Scope Findings

- Real reset-session should eventually call a session-store invalidation method, otherwise active in-memory sessions are not kicked immediately.
- Real notification retry needs a `failed_notifications` source and queue contract.
- Insights will stay sparse until production `ui_events` and `audit_logs` accumulate enough data.
- Local browser smoke ran in mock/no `DATABASE_URL` mode. Replit should validate DB-backed audit rows.

## Replit Acceptance Steps

1. IT 登入 `/system/operations`。
2. 搜尋一個員工帳號，看 user detail 載入。
3. 按「Reset Session」，填 reason，確認後查 `audit_logs` 是否有 `OPS_ASSIST_RESET_SESSION` 與 `OPS_RESET_SESSION`。
4. 若 auth/session-store 後續補 invalidation hook，再驗該員工 API 是否立即 401。
5. 進 `/system/insights`，確認 top modules、period toggle、role/facility 摘要。
6. 有 7 天以上 `ui_events` 後，確認 anomaly spike/drop 是否合理。
7. 點某 module row，確認 detail drawer 顯示 daily breakdown。
8. 非 system 角色訪問 IT-2 endpoints 應 403。
