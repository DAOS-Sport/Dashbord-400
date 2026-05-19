---
module_id: system-operations
label: "運維協助中心"
status: implemented
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: telemetry
generated_at: 2026-05-18
---

# 運維協助中心

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：不使用 Ragic；資料源為 telemetry
3. 功能 / 需求 / 用途：IT operations helper for user lookup, soft interventions, cache refresh, and notification resend. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `system-operations`
- Status: implemented / 已接線
- Domain: `system`
- Source of truth: `telemetry`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, system_only
- Priority: {"system":3}

## Implementation Owners

- UI owner：`client/src/modules/system/operations/page.tsx`。
- BFF route owner：`server/modules/system/operations-routes.ts`；user lookup、user detail、soft intervention、recent assists 都集中於此檔。
- 資料來源：`users`、`sessions_index`、`user_role_snapshots`、telemetry audit / client error repositories。
- 寫入治理：POST 類介入必須保留 reason >= 3、audit、system target guard，不得在 smoke test 執行破壞性操作。
- Authenticated BFF smoke：`scripts/authenticated-bff-smoke.ts` read-only 覆蓋 `/api/bff/system/operations/recent-assists`。
- Registry owner：`shared/modules/registry/foundation.ts`。


## 功能邏輯

- 入口從 `/system/operations` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/operations/user-search`、`GET /api/bff/system/operations/user/:userId`、`GET /api/bff/system/operations/recent-assists`。
- 寫入透過 `POST /api/bff/system/operations/user/:userId/reset-session`、`POST /api/bff/system/operations/user/:userId/refresh-cache`、`POST /api/bff/system/operations/user/:userId/resend-notification`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`users`、`sessions_index`、`audit_logs`、`client_errors`。

## 資料寫法 / 寫入規則

- 資料權威：`telemetry`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`users`、`sessions_index`。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`audit_logs`、`client_errors`。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/bff/system/operations/user/:userId/reset-session`、`POST /api/bff/system/operations/user/:userId/refresh-cache`、`POST /api/bff/system/operations/user/:userId/resend-notification`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- Registry uiStates：`loading`、`ready`、`empty`、`error`、`disabled`；freshness=`realtime`。
- 跨 section 視覺最小單元：`DenseRow`。
- 畫面資料應優先吃 BFF section / endpoint：`operations`、`/api/bff/system/operations/user-search`、`/api/bff/system/operations/user/:userId`、`/api/bff/system/operations/user/:userId/reset-session`、`/api/bff/system/operations/user/:userId/refresh-cache`、`/api/bff/system/operations/user/:userId/resend-notification`、`/api/bff/system/operations/recent-assists`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/operations/user-search`、`GET /api/bff/system/operations/user/:userId`、`POST /api/bff/system/operations/user/:userId/reset-session`、`POST /api/bff/system/operations/user/:userId/refresh-cache`、`POST /api/bff/system/operations/user/:userId/resend-notification`、`GET /api/bff/system/operations/recent-assists`。
- Section key / planned endpoint：systemSectionKey=`operations`、plannedEndpoint=`/api/bff/system/operations/user-search`、plannedEndpoint=`/api/bff/system/operations/user/:userId`、plannedEndpoint=`/api/bff/system/operations/user/:userId/reset-session`、plannedEndpoint=`/api/bff/system/operations/user/:userId/refresh-cache`、plannedEndpoint=`/api/bff/system/operations/user/:userId/resend-notification`、plannedEndpoint=`/api/bff/system/operations/recent-assists`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `users`、`sessions_index`、`audit_logs`、`client_errors` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/operations | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/operations/user-search | bff | implemented |
| GET | /api/bff/system/operations/user/:userId | bff | implemented |
| POST | /api/bff/system/operations/user/:userId/reset-session | bff | implemented |
| POST | /api/bff/system/operations/user/:userId/refresh-cache | bff | implemented |
| POST | /api/bff/system/operations/user/:userId/resend-notification | bff | implemented |
| GET | /api/bff/system/operations/recent-assists | bff | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | operations |
| plannedEndpoint | /api/bff/system/operations/user-search |
| plannedEndpoint | /api/bff/system/operations/user/:userId |
| plannedEndpoint | /api/bff/system/operations/user/:userId/reset-session |
| plannedEndpoint | /api/bff/system/operations/user/:userId/refresh-cache |
| plannedEndpoint | /api/bff/system/operations/user/:userId/resend-notification |
| plannedEndpoint | /api/bff/system/operations/recent-assists |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | loading, ready, empty, error, disabled |
| freshness | realtime |
| uiStateSourceFiles | `client/src/modules/system/operations/page.tsx` |
| sharedComponents | `DenseRow` |

## Data

| Table / Entity | Entity | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| users | operation target identity | postgres | legacy |  |
| sessions_index | session clear target | postgres | partial |  |
| audit_logs | operation intervention audit trail | telemetry | implemented |  |
| client_errors | recent user client errors | telemetry | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | User/session lookup and operation audit trail. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: OPS_RESET_SESSION, OPS_REFRESH_CACHE, OPS_RESEND_NOTIFICATION
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Soft interventions require a reason and are audit-logged before execution; system users cannot be targeted.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
