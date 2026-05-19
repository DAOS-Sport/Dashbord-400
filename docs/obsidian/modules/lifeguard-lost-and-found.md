---
module_id: lifeguard-lost-and-found
label: "失物招領"
status: partial
domain: support
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# 失物招領

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 lifeguard, employee
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Shared lost-and-found records with separated employee and lifeguard workbench entry points. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `lifeguard-lost-and-found`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page
- Priority: {"lifeguard":6}



## 功能邏輯

- 入口從 `/lifeguard/lost-and-found`、`/employee/lost-and-found` 進入，依角色 lifeguard、employee 顯示。
- 讀取透過 `GET /api/bff/employee/lost-and-found`、`GET /api/bff/lifeguard/lost-and-found`。
- 寫入透過 `POST /api/bff/employee/lost-and-found`、`PATCH /api/bff/employee/lost-and-found/:id`、`POST /api/bff/lifeguard/lost-and-found`、`PATCH /api/bff/lifeguard/lost-and-found/:id`。
- 外部或基礎依賴：OBJECT_STORAGE。
- 資料落點 / entity：`lifeguard_lost_and_found`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`lifeguard_lost_and_found`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/bff/employee/lost-and-found`、`PATCH /api/bff/employee/lost-and-found/:id`、`POST /api/bff/lifeguard/lost-and-found`、`PATCH /api/bff/lifeguard/lost-and-found/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`/api/bff/employee/lost-and-found`、`/api/bff/lifeguard/home`、`/api/bff/lifeguard/lost-and-found`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、card click、audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/employee/lost-and-found`、`POST /api/bff/employee/lost-and-found`、`PATCH /api/bff/employee/lost-and-found/:id`、`GET /api/bff/lifeguard/lost-and-found`、`POST /api/bff/lifeguard/lost-and-found`、`PATCH /api/bff/lifeguard/lost-and-found/:id`。
- Section key / planned endpoint：plannedEndpoint=`/api/bff/employee/lost-and-found`、plannedEndpoint=`/api/bff/lifeguard/home`、plannedEndpoint=`/api/bff/lifeguard/lost-and-found`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `lifeguard_lost_and_found` 的讀寫方向沒有繞過 owner module。
- 整合：確認 OBJECT_STORAGE 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /lifeguard/lost-and-found | lifeguard | lifeguard | partial |
| /employee/lost-and-found | employee | employee | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/employee/lost-and-found | bff | partial |
| POST | /api/bff/employee/lost-and-found | bff | partial |
| PATCH | /api/bff/employee/lost-and-found/:id | bff | partial |
| GET | /api/bff/lifeguard/lost-and-found | bff | partial |
| POST | /api/bff/lifeguard/lost-and-found | bff | partial |
| PATCH | /api/bff/lifeguard/lost-and-found/:id | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| plannedEndpoint | /api/bff/employee/lost-and-found |
| plannedEndpoint | /api/bff/lifeguard/home |
| plannedEndpoint | /api/bff/lifeguard/lost-and-found |

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
| lifeguard_lost_and_found | lost item photo and claim status records | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| OBJECT_STORAGE | Lost item photo upload storage. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=yes
- Event types: LIFEGUARD_LOST_ITEM_CREATED, LIFEGUARD_LOST_ITEM_UPDATED, LIFEGUARD_LOST_ITEM_CLAIMED, LIFEGUARD_LOST_ITEM_DISPOSED
- Editable by: employee, lifeguard, supervisor, system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Employee UI stays under /employee and lifeguard UI stays under /lifeguard; BFF endpoints map both entries to the same facility-scoped lost-and-found table.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
