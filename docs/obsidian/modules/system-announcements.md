---
module_id: system-announcements
label: "System Announcements"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# System Announcements

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 employee, lifeguard, supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Supervisor-maintained operational notices stored locally for portal and employee home display. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `system-announcements`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, portal_page
- Priority: {"employee":3,"supervisor":5}



## 功能邏輯

- 入口從 `/portal/:facilityKey/manage`、`/supervisor/announcements` 進入，依角色 employee、lifeguard、supervisor、system 顯示。
- 讀取透過 `GET /api/portal/system-announcements`。
- 寫入透過 `POST /api/portal/system-announcements`、`PATCH /api/portal/system-announcements/:id`、`DELETE /api/portal/system-announcements/:id`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`system_announcements`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`system_announcements`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/portal/system-announcements`、`PATCH /api/portal/system-announcements/:id`、`DELETE /api/portal/system-announcements/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`announcements`、`announcements`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：employeeSectionKey=`announcements`、supervisorSectionKey=`announcements`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/portal/system-announcements`、`POST /api/portal/system-announcements`、`PATCH /api/portal/system-announcements/:id`、`DELETE /api/portal/system-announcements/:id`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `system_announcements` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /portal/:facilityKey/manage | employee | legacy_portal | partial |
| /supervisor/announcements | supervisor | supervisor | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/portal/system-announcements | crud | implemented |
| POST | /api/portal/system-announcements | crud | implemented |
| PATCH | /api/portal/system-announcements/:id | crud | implemented |
| DELETE | /api/portal/system-announcements/:id | crud | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | announcements |
| supervisorSectionKey | announcements |

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
| system_announcements | system announcement | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Local supervisor-managed notices. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: 未登記
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: Local system announcements are editable by supervisors for their facility scope.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
