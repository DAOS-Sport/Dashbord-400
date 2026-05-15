# PR-IT-CONTROL-CENTER-1 Summary

## Sub-task Status

- IT1.0 聚合 BFF endpoint: completed
- IT1.1 `/system` 控制中心首頁: completed
- IT1.2 `/system/watchdog`: completed
- IT1.3 `/system/governance`: completed
- IT1.4 `/system/operations` 空殼: completed
- IT1.5 `/system/insights` 空殼: completed
- IT1.6 Module Registry / Navigation 對齊: completed
- IT1.7 Smoke 與 Unit Test: completed

## Files Changed

### Backend

- `server/modules/system/routes.ts`
  - Added `GET /api/bff/system/control-center` with `requireSession` + `requireRole("system")`.
  - Aggregates module health, audit count, watchdog critical count, governance orphan count, and recent critical/warning events.
  - Uses 5 second in-memory cache and safe fallback reads.

### Shared Registry / Navigation

- `shared/modules/ids.ts`
  - Added `system-control-center`, `system-watchdog`, `system-operations`, `system-insights`, `system-governance`.

- `shared/navigation/workbench-routes.ts`
  - Replaced System navigation with the 5-entry architecture.
  - Redirects legacy system pages into `/system/watchdog` or `/system/governance`.

- `shared/modules/descriptors.ts`
  - Updated System navigation and home card order to exactly 5 modules.
  - Moved old system pages out of primary nav/card visibility.

- `shared/modules/registry.ts`
  - Added the 5 new System module definitions.
  - Marked old system dashboard/health/observability/audit/raw/topology/function-relation entries as legacy-compatible submodules.

### Frontend

- `client/src/App.tsx`
  - Added routes for `/system/watchdog`, `/system/operations`, `/system/insights`, `/system/governance`.
  - `/system` and `/SYSTEM` now render the control center.

- `client/src/modules/system/control-center/api.ts`
  - Added control-center DTO and fetcher.

- `client/src/modules/system/control-center/page.tsx`
  - New IT control center page with KPI bar, 4 entry tiles, and recent critical event list.

- `client/src/modules/system/watchdog/page.tsx`
  - New Watchdog page with Health, Alerts, and Integrations tabs.

- `client/src/modules/system/governance/page.tsx`
  - New Governance page with Module Registry, Function Relations, Topology, Audit Raw, and Raw Inspector tabs.

- `client/src/modules/system/operations/page.tsx`
  - Placeholder page with NotConnectedCard.

- `client/src/modules/system/insights/page.tsx`
  - Placeholder page with NotConnectedCard.

### Tests / Tooling

- `scripts/module-smoke.ts`
  - System navigation and homepage card expectations updated to 5 entries.

- `scripts/module-unit-tests.ts`
  - Added System 5-entry route/registry/page assertions.
  - Added control-center BFF guard assertion.

## New BFF Endpoints

- `GET /api/bff/system/control-center`

## Module Registry Summary

New canonical system modules:

- `system-control-center` -> `/system`
- `system-watchdog` -> `/system/watchdog`
- `system-operations` -> `/system/operations`
- `system-insights` -> `/system/insights`
- `system-governance` -> `/system/governance`

Primary System navigation order is now exactly:

1. `system-control-center`
2. `system-watchdog`
3. `system-operations`
4. `system-insights`
5. `system-governance`

Legacy system modules remain registered and visible in governance/health surfaces, but they no longer appear in primary navigation.

## Verification

- `npm run type-check`: passed
- `npm run check`: passed
- `npm run check:modules`: passed
- `npm run smoke:modules`: passed
- `npm run unit:modules`: passed
- `npm run dry-run`: passed

Dry-run reported:

- descriptors: 79
- system navigation: 5
- system home cards: 5
- no suspicious user-facing modules without BFF binding
- build passed

## Halt Decisions

- None.

## Out of Scope Findings

- `/system/operations` and `/system/insights` remain placeholders by product decision for Batch IT-2.
- Existing legacy system pages are redirected at route level into Watchdog/Governance, rather than deleted.
- Recent Critical Events depends on `watchdog_events` having real rows; empty state is expected if no events are written.
- No schema or migration changes were made.

## Replit Acceptance Steps

1. IT 登入 `/system`，確認看到控制中心首頁與 4 個子入口 tile。
2. KPI bar 顯示 Ready / Degraded / NotConnected / Error / Audit 24h / Critical 24h。
3. 點 Watchdog tile 進 `/system/watchdog`，確認 Health / Alerts / Integrations 三個 tab 可切。
4. 點 Governance tile 進 `/system/governance`，確認 Module Registry / Function Relations / Topology / Audit Raw / Raw Inspector 五個 tab 可切。
5. 點 Operations / Insights tile，確認顯示下版啟用 NotConnectedCard。
6. 若 `watchdog_events` 有資料，確認 Recent Critical Events 顯示最近 5 筆 critical/warning。
7. 非 system 角色訪問 `/system` 應被導回允許角色入口或拒絕。
