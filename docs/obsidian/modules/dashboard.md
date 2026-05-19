---
module_id: dashboard
label: "Dashboard"
status: implemented
domain: derived
owner_role: system
source_of_truth: projection
generated_at: 2026-05-18
---

# Dashboard

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 employee, lifeguard, supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 projection
3. 功能 / 需求 / 用途：Legacy admin dashboard plus supervisor/system/employee workbench home shell orchestration. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `dashboard`
- Status: implemented / 已接線
- Domain: `derived`
- Source of truth: `projection`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, admin_page
- Priority: {"employee":1,"supervisor":1,"system":1}



## 功能邏輯

- 入口從 `/`、`/employee`、`/employee/home`、`/supervisor`、`/supervisor/home`、`/system`、`/system/overview` 進入，依角色 employee、lifeguard、supervisor、system 顯示。
- 讀取透過 `GET /api/bff/employee/home`、`GET /api/bff/supervisor/dashboard`、`GET /api/bff/system/overview`、`GET /api/admin/overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：LINE_BOT_ASSISTANT、SMART_SCHEDULE_MANAGER、POSTGRES。
- 資料落點 / entity：`employee_home_projection`、`supervisor_dashboard_projection`、`system_overview_projection`。

## 資料寫法 / 寫入規則

- 資料權威：`projection`。
- 沒有 Postgres 寫入權威登記。
- Projection 資料只能由 BFF / sync job 重建或更新，頁面不得自行當作權威：`employee_home_projection`、`supervisor_dashboard_projection`、`system_overview_projection`。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`home`、`dashboard`、`overview`、`/api/bff/employee/home`、`/api/bff/supervisor/dashboard`、`/api/bff/system/overview`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/employee/home`、`GET /api/bff/supervisor/dashboard`、`GET /api/bff/system/overview`。
- Section key / planned endpoint：employeeSectionKey=`home`、supervisorSectionKey=`dashboard`、systemSectionKey=`overview`、plannedEndpoint=`/api/bff/employee/home`、plannedEndpoint=`/api/bff/supervisor/dashboard`、plannedEndpoint=`/api/bff/system/overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/admin/overview`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `employee_home_projection`、`supervisor_dashboard_projection`、`system_overview_projection` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT、SMART_SCHEDULE_MANAGER、POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| / | system | legacy_admin | implemented |
| /employee | employee | employee | implemented |
| /employee/home | employee | employee | implemented |
| /supervisor | supervisor | supervisor | implemented |
| /supervisor/home | supervisor | supervisor | implemented |
| /system | system | system | implemented |
| /system/overview | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/employee/home | bff | partial |
| GET | /api/bff/supervisor/dashboard | bff | partial |
| GET | /api/bff/system/overview | bff | partial |
| GET | /api/admin/overview | proxy | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | home |
| supervisorSectionKey | dashboard |
| systemSectionKey | overview |
| plannedEndpoint | /api/bff/employee/home |
| plannedEndpoint | /api/bff/supervisor/dashboard |
| plannedEndpoint | /api/bff/system/overview |

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
| employee_home_projection | employee home projection | projection | partial |  |
| supervisor_dashboard_projection | supervisor dashboard projection | projection | partial |  |
| system_overview_projection | system overview projection | projection | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | Announcement and employee home fallback summaries. | external |  |
| SMART_SCHEDULE_MANAGER | Supervisor staffing and shift summaries. | external |  |
| POSTGRES | Projection cache and local portal data. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: CARD_CLICK
- Editable by: system
- Readonly for: employee, supervisor
- Requires approval: no
- Governance notes: Dashboard composition should stay in BFF DTOs, not page-local fetch fan-out.

## Legacy

- Old names: 無
- Old routes: /, /api/admin/overview
- Migration notes: Legacy admin dashboard remains available while workbench routes are primary.
