---
module_id: line-whitelist
label: "400 LINE 白名單管理"
status: implemented
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: postgres
generated_at: 2026-05-18
---

# 400 LINE 白名單管理

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：RAGIC：Employee candidate source for name, userid, phone, and department.
3. 功能 / 需求 / 用途：System-managed whitelist for 400 LINE official account feature access, including interview and caution-query feature switches. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `line-whitelist`
- Status: implemented / 已接線
- Domain: `system`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, system_only
- Priority: {"system":8}

## Implementation Owners

- UI owner：`client/src/modules/system/line-whitelist/page.tsx`、`client/src/modules/system/line-whitelist/api.ts`。
- BFF route owner：`server/modules/system/line-whitelist-routes.ts`；不得再把白名單 CRUD 加回 `server/modules/system/routes.ts`。
- 慎用 / 面試權限 owner：`server/modules/system/caution-permissions-routes.ts`；授權期限、狀態切換、audit 都集中在此檔。
- 400LINE 服務狀態 / proxy owner：`server/modules/system/line-bot-routes.ts`；前端不得直接呼叫 400LINE upstream。
- Domain service / DTO owner：`server/modules/system/line-whitelist-service.ts`、`shared/system/line-whitelist-contract.ts`。
- Registry owner：`shared/modules/registry/foundation.ts`、`shared/modules/descriptors.ts`。


## 功能邏輯

- 入口從 `/system/line-whitelist` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/line-whitelist`、`GET /api/bff/system/line-whitelist/candidates`、`GET /api/internal/line-whitelist/check`、`GET /api/cms/system/caution-permissions`、`GET /api/cms/system/caution-permissions/candidates`、`GET /api/cms/system/caution-permissions/check`、`GET /api/cms/system/caution-permissions/:id/audit`。
- 寫入透過 `POST /api/bff/system/line-whitelist`、`PATCH /api/bff/system/line-whitelist/:id`、`POST /api/cms/system/caution-permissions`、`PATCH /api/cms/system/caution-permissions/:id/period`、`PATCH /api/cms/system/caution-permissions/:id/status`、`POST /api/cms/system/caution-permissions/:id/log-usage`。
- 外部或基礎依賴：RAGIC、LINE_BOT_ASSISTANT、POSTGRES。
- 資料落點 / entity：`line_feature_whitelist`、`caution_query_permissions`、`caution_query_permission_audit`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`line_feature_whitelist`、`caution_query_permissions`、`caution_query_permission_audit`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/bff/system/line-whitelist`、`PATCH /api/bff/system/line-whitelist/:id`、`POST /api/cms/system/caution-permissions`、`PATCH /api/cms/system/caution-permissions/:id/period`、`PATCH /api/cms/system/caution-permissions/:id/status`、`POST /api/cms/system/caution-permissions/:id/log-usage`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`lineWhitelist`、`/api/bff/system/line-whitelist`、`/api/bff/system/line-whitelist/candidates`、`/api/internal/line-whitelist/check`、`/api/cms/system/caution-permissions`、`/api/cms/system/caution-permissions/candidates`、`/api/cms/system/caution-permissions/check`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/line-whitelist`、`GET /api/bff/system/line-whitelist/candidates`、`GET /api/internal/line-whitelist/check`、`GET /api/cms/system/caution-permissions`、`GET /api/cms/system/caution-permissions/candidates`、`GET /api/cms/system/caution-permissions/check`。
- Section key / planned endpoint：systemSectionKey=`lineWhitelist`、plannedEndpoint=`/api/bff/system/line-whitelist`、plannedEndpoint=`/api/bff/system/line-whitelist/candidates`、plannedEndpoint=`/api/internal/line-whitelist/check`、plannedEndpoint=`/api/cms/system/caution-permissions`、plannedEndpoint=`/api/cms/system/caution-permissions/candidates`、plannedEndpoint=`/api/cms/system/caution-permissions/check`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`POST /api/bff/system/line-whitelist`、`PATCH /api/bff/system/line-whitelist/:id`、`POST /api/cms/system/caution-permissions`、`PATCH /api/cms/system/caution-permissions/:id/period`、`PATCH /api/cms/system/caution-permissions/:id/status`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `line_feature_whitelist`、`caution_query_permissions`、`caution_query_permission_audit` 的讀寫方向沒有繞過 owner module。
- 整合：確認 RAGIC、LINE_BOT_ASSISTANT、POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/line-whitelist | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/line-whitelist | bff | implemented |
| GET | /api/bff/system/line-whitelist/candidates | bff | implemented |
| POST | /api/bff/system/line-whitelist | crud | implemented |
| PATCH | /api/bff/system/line-whitelist/:id | crud | implemented |
| GET | /api/internal/line-whitelist/check | bff | partial |
| GET | /api/cms/system/caution-permissions | bff | implemented |
| GET | /api/cms/system/caution-permissions/candidates | bff | implemented |
| POST | /api/cms/system/caution-permissions | crud | implemented |
| PATCH | /api/cms/system/caution-permissions/:id/period | crud | implemented |
| PATCH | /api/cms/system/caution-permissions/:id/status | crud | implemented |
| GET | /api/cms/system/caution-permissions/check | bff | implemented |
| GET | /api/cms/system/caution-permissions/:id/audit | telemetry | implemented |
| POST | /api/cms/system/caution-permissions/:id/log-usage | telemetry | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | lineWhitelist |
| plannedEndpoint | /api/bff/system/line-whitelist |
| plannedEndpoint | /api/bff/system/line-whitelist/candidates |
| plannedEndpoint | /api/internal/line-whitelist/check |
| plannedEndpoint | /api/cms/system/caution-permissions |
| plannedEndpoint | /api/cms/system/caution-permissions/candidates |
| plannedEndpoint | /api/cms/system/caution-permissions/check |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | 未登記 |
| freshness | 未登記 |
| uiStateSourceFiles | 未登記 |
| sharedComponents | 未登記 |

## Data

| Table / Entity | Entity | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| line_feature_whitelist | LINE official account feature whitelist | postgres | implemented |  |
| caution_query_permissions | caution query permission | postgres | implemented |  |
| caution_query_permission_audit | caution query permission audit trail | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| RAGIC | Employee candidate source for name, userid, phone, and department. | external |  |
| LINE_BOT_ASSISTANT | External LINE webhook checks feature access by lineUserId. | external |  |
| POSTGRES | Whitelist status, feature switches, and authorization window. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: LINE_WHITELIST_CREATED, LINE_WHITELIST_UPDATED
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Entries are never deleted through the CMS; disable status or expiry must be used to revoke access.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
