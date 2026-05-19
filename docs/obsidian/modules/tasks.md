---
module_id: tasks
label: "Tasks"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Tasks

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 employee, lifeguard, supervisor
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Employee self-created tasks and supervisor-assigned same-facility tasks backed by the dedicated tasks table. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `tasks`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page
- Priority: {"employee":4,"supervisor":2}



## 功能邏輯

- 入口從 `/employee/tasks`、`/supervisor/tasks` 進入，依角色 employee、lifeguard、supervisor 顯示。
- 讀取透過 `GET /api/tasks`。
- 寫入透過 `POST /api/tasks`、`PATCH /api/tasks/:id`、`PATCH /api/tasks/:id/status`、`DELETE /api/tasks/:id`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`tasks`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`tasks`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/tasks`、`PATCH /api/tasks/:id`、`PATCH /api/tasks/:id/status`、`DELETE /api/tasks/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- Registry uiStates：`loading`、`ready`、`empty`、`error`、`disabled`；freshness=`realtime`。
- 跨 section 視覺最小單元：`TaskRow`。
- 畫面資料應優先吃 BFF section / endpoint：`tasks`、`incompleteTasks`、`/api/bff/employee/home`、`/api/bff/supervisor/dashboard`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、card click、action submit。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：employeeSectionKey=`tasks`、supervisorSectionKey=`incompleteTasks`、plannedEndpoint=`/api/bff/employee/home`、plannedEndpoint=`/api/bff/supervisor/dashboard`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/tasks`、`POST /api/tasks`、`PATCH /api/tasks/:id`、`PATCH /api/tasks/:id/status`、`DELETE /api/tasks/:id`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `tasks` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /employee/tasks | employee | employee | implemented |
| /supervisor/tasks | supervisor | supervisor | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/tasks | crud | implemented |
| POST | /api/tasks | crud | implemented |
| PATCH | /api/tasks/:id | crud | implemented |
| PATCH | /api/tasks/:id/status | crud | implemented |
| DELETE | /api/tasks/:id | crud | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | tasks |
| supervisorSectionKey | incompleteTasks |
| plannedEndpoint | /api/bff/employee/home |
| plannedEndpoint | /api/bff/supervisor/dashboard |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | loading, ready, empty, error, disabled |
| freshness | realtime |
| uiStateSourceFiles | `client/src/modules/employee/tasks/page.tsx`<br>`client/src/modules/supervisor/tasks/page.tsx` |
| sharedComponents | `TaskRow` |

## Data

| Table / Entity | Entity | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| tasks | employee and supervisor task | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Dedicated task CRUD and completion state. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=yes；auditRequired=no
- Event types: task_create, task_update, task_complete, task_delete
- Editable by: supervisor, employee
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Employees may edit/delete self-created tasks; supervisors manage same-facility tasks; employees may complete assigned or self-created tasks.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
