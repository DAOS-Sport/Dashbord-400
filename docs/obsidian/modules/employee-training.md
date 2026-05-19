---
module_id: employee-training
label: "Employee Training"
status: partial
domain: support
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Employee Training

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 employee, lifeguard, supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Employee training library for work videos, images, notes, and operational learning material. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `employee-training`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `postgres`
- Homepage widget: no
- Visibility: detail_page, admin_page
- Priority: {"employee":15,"supervisor":15,"system":22}



## 功能邏輯

- 入口從 `/employee/training`、`/supervisor/training`、`/system/training-views` 進入，依角色 employee、lifeguard、supervisor、system 顯示。
- 讀取透過 `GET /api/portal/employee-resources`、`GET /api/bff/employee/home`、`GET /api/telemetry/training-views`。
- 寫入透過 `POST /api/portal/employee-resources`、`PATCH /api/portal/employee-resources/:id`、`DELETE /api/portal/employee-resources/:id`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`employee_resources`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`employee_resources`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/portal/employee-resources`、`PATCH /api/portal/employee-resources/:id`、`DELETE /api/portal/employee-resources/:id`。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`training`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、card click、action submit。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/employee/home`。
- Section key / planned endpoint：employeeSectionKey=`training`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/portal/employee-resources`、`POST /api/portal/employee-resources`、`PATCH /api/portal/employee-resources/:id`、`DELETE /api/portal/employee-resources/:id`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `employee_resources` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /employee/training | employee | employee | partial |
| /supervisor/training | supervisor | supervisor | partial |
| /system/training-views | system | system | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/portal/employee-resources | crud | partial |
| POST | /api/portal/employee-resources | crud | partial |
| PATCH | /api/portal/employee-resources/:id | crud | partial |
| DELETE | /api/portal/employee-resources/:id | crud | partial |
| GET | /api/bff/employee/home | bff | partial |
| GET | /api/telemetry/training-views | telemetry | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | training |

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
| employee_resources | training resource | postgres | implemented | category=training, url may point to video/image/link material. |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Employee training resources and material metadata. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=yes；auditRequired=no
- Event types: TRAINING_VIEW, resource_create
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: Employee reader, supervisor material management, and system training-view report are wired; still partial until role-specific acceptance coverage is complete.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
