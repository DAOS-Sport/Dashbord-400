---
module_id: announcements
label: "Announcements"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: external
generated_at: 2026-05-18
---

# Announcements

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 employee, lifeguard, supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Employee-visible announcements from LINE group messages (via announcement-groups binding), locally managed system announcements, and resource portal announcements. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `announcements`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `external`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, portal_page
- Priority: {"employee":2,"supervisor":4}



## 功能邏輯

- 入口從 `/portal/:facilityKey/announcements`、`/portal/:facilityKey/announcements/:id`、`/employee/announcements`、`/supervisor/announcements` 進入，依角色 employee、lifeguard、supervisor、system 顯示。
- 讀取透過 `GET /api/facility-home/:groupId/announcements`、`GET /api/facility-home/:groupId/announcements/:id`、`GET /api/announcements/acknowledgements`、`GET /api/portal/system-announcements`。
- 寫入透過 `POST /api/facility-home/:groupId/announcements/:id/ack`、`POST /api/announcements/:id/ack`、`POST /api/portal/system-announcements`、`PATCH /api/portal/system-announcements/:id`、`DELETE /api/portal/system-announcements/:id`。
- 外部或基礎依賴：LINE_BOT_ASSISTANT。
- 資料落點 / entity：`system_announcements`、`announcement_acknowledgements`、`portal_events`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`system_announcements`、`announcement_acknowledgements`。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`portal_events`。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/facility-home/:groupId/announcements/:id/ack`、`POST /api/announcements/:id/ack`、`POST /api/portal/system-announcements`、`PATCH /api/portal/system-announcements/:id`、`DELETE /api/portal/system-announcements/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- Registry uiStates：`loading`、`ready`、`empty`、`error`、`degraded`、`stale`、`disabled`；freshness=`5min`。
- 跨 section 視覺最小單元：`AnnouncementCard`、`FreshnessIndicator`。
- 畫面資料應優先吃 BFF section / endpoint：`announcements`、`announcementAcks`、`/api/bff/employee/home`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、card click、action submit。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：employeeSectionKey=`announcements`、supervisorSectionKey=`announcementAcks`、plannedEndpoint=`/api/bff/employee/home`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/announcements/acknowledgements`、`POST /api/announcements/:id/ack`、`GET /api/portal/system-announcements`、`POST /api/portal/system-announcements`、`PATCH /api/portal/system-announcements/:id`、`DELETE /api/portal/system-announcements/:id`。
- Proxy / external 邊界：`GET /api/facility-home/:groupId/announcements`、`GET /api/facility-home/:groupId/announcements/:id`、`POST /api/facility-home/:groupId/announcements/:id/ack`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `system_announcements`、`announcement_acknowledgements`、`portal_events` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /portal/:facilityKey/announcements | employee | legacy_portal | legacy |
| /portal/:facilityKey/announcements/:id | employee | legacy_portal | legacy |
| /employee/announcements | employee | employee | implemented |
| /supervisor/announcements | supervisor | supervisor | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/facility-home/:groupId/announcements | proxy | legacy |
| GET | /api/facility-home/:groupId/announcements/:id | proxy | legacy |
| POST | /api/facility-home/:groupId/announcements/:id/ack | proxy | legacy |
| GET | /api/announcements/acknowledgements | crud | partial |
| POST | /api/announcements/:id/ack | crud | partial |
| GET | /api/portal/system-announcements | crud | partial |
| POST | /api/portal/system-announcements | crud | partial |
| PATCH | /api/portal/system-announcements/:id | crud | partial |
| DELETE | /api/portal/system-announcements/:id | crud | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | announcements |
| supervisorSectionKey | announcementAcks |
| plannedEndpoint | /api/bff/employee/home |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | loading, ready, empty, error, degraded, stale, disabled |
| freshness | 5min |
| uiStateSourceFiles | `client/src/modules/employee/home/employee-home-page.tsx`<br>`client/src/modules/supervisor/announcements/page.tsx` |
| sharedComponents | `AnnouncementCard`, `FreshnessIndicator` |

## Data

| Table / Entity | Entity | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| system_announcements | system announcement | postgres | implemented |  |
| announcement_acknowledgements | employee announcement acknowledgement | postgres | partial |  |
| portal_events | announcement read/open events | telemetry | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | Facility announcements and acknowledgement proxy. | external |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=yes；auditRequired=no
- Event types: announcement_open, pageview
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: Employee-visible content may come from LINE proxy or local system_announcements.

## Legacy

- Old names: 無
- Old routes: /portal/:facilityKey/announcements, /api/facility-home/:groupId/announcements
- Migration notes: 無
