---
module_id: handover
label: "交辦事項"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# 交辦事項

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 employee, lifeguard, supervisor
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Facility-scoped shared assignment surface for counter, lifeguard, and supervisor roles. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `handover`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, portal_page
- Priority: {"employee":4,"supervisor":3}



## 功能邏輯

- 入口從 `/portal/:facilityKey/handover`、`/employee/handover`、`/lifeguard/handover`、`/supervisor/handover` 進入，依角色 employee、lifeguard、supervisor 顯示。
- 讀取透過 `GET /api/portal/handovers`、`GET /api/bff/employee/handover/summary`、`GET /api/bff/employee/handover/list`、`GET /api/portal/operational-handovers`、`GET /api/facility-home/:groupId/handover`。
- 寫入透過 `POST /api/portal/handovers`、`DELETE /api/portal/handovers/:id`、`POST /api/handover`、`POST /api/handover/image-upload`、`PATCH /api/handover/:id/read`、`PATCH /api/handover/:id/reply`、`PATCH /api/handover/:id/complete`、`POST /api/portal/operational-handovers`、`PATCH /api/portal/operational-handovers/:id`、`PATCH /api/portal/operational-handovers/:id/report`、`DELETE /api/portal/operational-handovers/:id`。
- 外部或基礎依賴：POSTGRES、OBJECT_STORAGE、SMART_SCHEDULE_MANAGER。
- 資料落點 / entity：`handover_entries`、`operational_handovers`、`portal_events`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`handover_entries`、`operational_handovers`。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`portal_events`。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/portal/handovers`、`DELETE /api/portal/handovers/:id`、`POST /api/handover`、`POST /api/handover/image-upload`、`PATCH /api/handover/:id/read`、`PATCH /api/handover/:id/reply`、`PATCH /api/handover/:id/complete`、`POST /api/portal/operational-handovers`、`PATCH /api/portal/operational-handovers/:id`、`PATCH /api/portal/operational-handovers/:id/report`、`DELETE /api/portal/operational-handovers/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- Registry uiStates：`loading`、`ready`、`empty`、`error`、`disabled`；freshness=`realtime`。
- 跨 section 視覺最小單元：`DenseRow`、`StatCard`。
- 畫面資料應優先吃 BFF section / endpoint：`handover`、`handoverOverview`、`/api/bff/employee/handover/list`、`/api/bff/employee/handover/summary`、`/api/bff/supervisor/dashboard`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、card click、action submit。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/employee/handover/summary`、`GET /api/bff/employee/handover/list`。
- Section key / planned endpoint：employeeSectionKey=`handover`、supervisorSectionKey=`handoverOverview`、plannedEndpoint=`/api/bff/employee/handover/list`、plannedEndpoint=`/api/bff/employee/handover/summary`、plannedEndpoint=`/api/bff/supervisor/dashboard`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/portal/handovers`、`POST /api/portal/handovers`、`DELETE /api/portal/handovers/:id`、`POST /api/handover`、`PATCH /api/handover/:id/read`、`PATCH /api/handover/:id/reply`、`PATCH /api/handover/:id/complete`、`GET /api/portal/operational-handovers`、`POST /api/portal/operational-handovers`、`PATCH /api/portal/operational-handovers/:id`、`PATCH /api/portal/operational-handovers/:id/report`、`DELETE /api/portal/operational-handovers/:id`。
- Proxy / external 邊界：`GET /api/facility-home/:groupId/handover`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `handover_entries`、`operational_handovers`、`portal_events` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES、OBJECT_STORAGE、SMART_SCHEDULE_MANAGER 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /portal/:facilityKey/handover | employee | legacy_portal | legacy |
| /employee/handover | employee | employee | implemented |
| /lifeguard/handover | lifeguard | lifeguard | implemented |
| /supervisor/handover | supervisor | supervisor | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/portal/handovers | crud | implemented |
| POST | /api/portal/handovers | crud | implemented |
| DELETE | /api/portal/handovers/:id | crud | implemented |
| POST | /api/handover | crud | implemented |
| POST | /api/handover/image-upload | upload | implemented |
| PATCH | /api/handover/:id/read | crud | implemented |
| PATCH | /api/handover/:id/reply | crud | implemented |
| PATCH | /api/handover/:id/complete | crud | implemented |
| GET | /api/bff/employee/handover/summary | bff | implemented |
| GET | /api/bff/employee/handover/list | bff | implemented |
| GET | /api/portal/operational-handovers | crud | implemented |
| POST | /api/portal/operational-handovers | crud | implemented |
| PATCH | /api/portal/operational-handovers/:id | crud | implemented |
| PATCH | /api/portal/operational-handovers/:id/report | crud | implemented |
| DELETE | /api/portal/operational-handovers/:id | crud | implemented |
| GET | /api/facility-home/:groupId/handover | proxy | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | handover |
| supervisorSectionKey | handoverOverview |
| plannedEndpoint | /api/bff/employee/handover/list |
| plannedEndpoint | /api/bff/employee/handover/summary |
| plannedEndpoint | /api/bff/supervisor/dashboard |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | loading, ready, empty, error, disabled |
| freshness | realtime |
| uiStateSourceFiles | `client/src/modules/employee/handover/page.tsx`<br>`client/src/modules/supervisor/handover/page.tsx`<br>`client/src/modules/supervisor/dashboard-page.tsx` |
| sharedComponents | `DenseRow`, `StatCard` |

## Data

| Table / Entity | Entity | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| handover_entries | legacy handover entry | postgres | implemented |  |
| operational_handovers | operational handover | postgres | implemented |  |
| portal_events | handover events | telemetry | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Local handover persistence. | implemented |  |
| OBJECT_STORAGE | Handover image record uploads. | implemented |  |
| SMART_SCHEDULE_MANAGER | Optional assignee resolution from schedule export. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=yes；auditRequired=no
- Event types: handover_create, handover_report, handover_claim, handover_complete, handover_reply, handover_delete
- Editable by: employee, lifeguard, supervisor
- Readonly for: 未登記
- Requires approval: no
- Governance notes: 交辦事項是舊任務與舊個人記事退役後唯一工作事項頁；counter/employee, lifeguard, and supervisor share operational_handovers by facilityKey.

## Legacy

- Old names: 無
- Old routes: /portal/:facilityKey/handover, /api/facility-home/:groupId/handover
- Migration notes: 無
