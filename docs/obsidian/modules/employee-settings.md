---
module_id: employee-settings
label: "員工設定"
status: partial
domain: support
owner_role: employee
source_of_truth: postgres
generated_at: 2026-05-18
---

# 員工設定

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：employee；可見角色 employee
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Employee-facing settings surface for shortcut ordering and workbench preferences. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `employee-settings`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `postgres`
- Homepage widget: no
- Visibility: detail_page
- Priority: {}



## 功能邏輯

- 入口從 `/employee/settings` 進入，依角色 employee 顯示。
- 讀取透過 `GET /api/portal/quick-links`。
- 寫入透過 `PATCH /api/portal/layout-settings`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`quick_links`、`widget_layout_settings`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`quick_links`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`PATCH /api/portal/layout-settings`。

## UI/UX 邏輯

- Surface model：role detail page；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`settings`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：employeeSectionKey=`settings`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/portal/quick-links`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 role detail page 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `quick_links`、`widget_layout_settings` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /employee/settings | employee | employee | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/portal/quick-links | crud | partial |
| PATCH | /api/portal/layout-settings | legacy | deprecated |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | settings |

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
| quick_links | shortcut entries | postgres | implemented |  |
| widget_layout_settings | legacy widget ordering | legacy | deprecated |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Employee preferences and shortcut ordering. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=no
- Event types: layout_update
- Editable by: employee, system
- Readonly for: supervisor
- Requires approval: no
- Governance notes: Settings is a route-level support surface, not a sidebar module.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
