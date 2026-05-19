---
module_id: activity-periods
label: "活動檔期 / 課程快訊"
status: partial
domain: support
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# 活動檔期 / 課程快訊

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 employee, supervisor
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Employee activity-period and course-news surface backed by employee_resources and announcement/event content. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `activity-periods`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page
- Priority: {"employee":3}



## 功能邏輯

- 入口從 `/employee/activity-periods`、`/employee/activity-periods/:id`、`/portal/:facilityKey/campaigns` 進入，依角色 employee、supervisor 顯示。
- 讀取透過 `GET /api/portal/employee-resources`、`GET /api/facility-home/:groupId/campaigns`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`employee_resources`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`employee_resources`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`events`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：employeeSectionKey=`events`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/portal/employee-resources`。
- Proxy / external 邊界：`GET /api/facility-home/:groupId/campaigns`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `employee_resources` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /employee/activity-periods | employee | employee | partial |
| /employee/activity-periods/:id | employee | employee | partial |
| /portal/:facilityKey/campaigns | employee | legacy_portal | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/portal/employee-resources | crud | partial |
| GET | /api/facility-home/:groupId/campaigns | proxy | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | events |

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
| employee_resources | activity and course resource | postgres | implemented | category=event or announcement-like course content. |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Employee activity period and course-news content. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: employee, supervisor, system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Employee can view and use entry points; supervisor remains content governance owner.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
