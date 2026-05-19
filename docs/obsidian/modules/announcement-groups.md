---
module_id: announcement-groups
label: "Announcement Groups"
status: implemented
domain: support
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Announcement Groups

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Facility to LINE group binding management for employee group announcements. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `announcement-groups`
- Status: implemented / 已接線
- Domain: `support`
- Source of truth: `postgres`
- Homepage widget: no
- Visibility: detail_page, admin_page
- Priority: {"supervisor":9}



## 功能邏輯

- 入口從 `/supervisor/announcement-groups`、`/admin/announcement-groups` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/integrations/announcement-groups/messages`、`GET /api/admin/announcement-groups`。
- 寫入透過 `POST /api/admin/announcement-groups`、`PATCH /api/admin/announcement-groups/:id`、`DELETE /api/admin/announcement-groups/:id`、`POST /api/admin/announcement-groups/:id/test-fetch`。
- 外部或基礎依賴：LINE_BOT_ASSISTANT。
- 資料落點 / entity：`facility_announcement_groups`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`facility_announcement_groups`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/admin/announcement-groups`、`PATCH /api/admin/announcement-groups/:id`、`DELETE /api/admin/announcement-groups/:id`、`POST /api/admin/announcement-groups/:id/test-fetch`。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`announcements`、`announcementGroups`、`/api/bff/employee/home`、`/api/integrations/announcement-groups/messages`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/integrations/announcement-groups/messages`。
- Section key / planned endpoint：employeeSectionKey=`announcements`、supervisorSectionKey=`announcementGroups`、plannedEndpoint=`/api/bff/employee/home`、plannedEndpoint=`/api/integrations/announcement-groups/messages`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/admin/announcement-groups`、`POST /api/admin/announcement-groups`、`PATCH /api/admin/announcement-groups/:id`、`DELETE /api/admin/announcement-groups/:id`、`POST /api/admin/announcement-groups/:id/test-fetch`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `facility_announcement_groups` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor/announcement-groups | supervisor | supervisor | implemented |
| /admin/announcement-groups | system | legacy_admin | legacy |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/integrations/announcement-groups/messages | bff | implemented |
| GET | /api/admin/announcement-groups | crud | implemented |
| POST | /api/admin/announcement-groups | crud | implemented |
| PATCH | /api/admin/announcement-groups/:id | crud | implemented |
| DELETE | /api/admin/announcement-groups/:id | crud | implemented |
| POST | /api/admin/announcement-groups/:id/test-fetch | crud | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | announcements |
| supervisorSectionKey | announcementGroups |
| plannedEndpoint | /api/bff/employee/home |
| plannedEndpoint | /api/integrations/announcement-groups/messages |

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
| facility_announcement_groups | facility LINE announcement group binding | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | Read LINE group text messages by facility binding. | external |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: announcement_group_create, announcement_group_update, announcement_group_delete, announcement_group_test_fetch
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: Employees may preview resolved group announcements but cannot mutate group bindings.

## Legacy

- Old names: 無
- Old routes: /admin/announcement-groups
- Migration notes: 無
