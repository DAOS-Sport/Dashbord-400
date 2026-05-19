---
module_id: courts
label: "Courts"
status: partial
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Courts

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 employee, supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：場地預約模組 covering 新北高中 and 三重商工 calendars, week/month/search/admin views. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `courts`
- Status: partial / 部分接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, admin_page
- Priority: {"supervisor":12}



## 功能邏輯

- 入口從 `/employee/courts/xinbei`、`/employee/courts/:school`、`/employee/courts/:school/week`、`/employee/courts/:school/month`、`/employee/courts/:school/search`、`/employee/courts/:school/admin`、`/supervisor/courts/xinbei`、`/supervisor/courts/:school`、`/supervisor/courts/:school/week`、`/supervisor/courts/:school/month`、`/supervisor/courts/:school/search`、`/supervisor/courts/:school/admin`、`/supervisor/courts/xinbei`、`/courts/xinbei`、`/courts/sanchong` 進入，依角色 employee、supervisor、system 顯示。
- 讀取透過 `GET /api/courts/reservations`。
- 寫入透過 `POST /api/courts/reservations`、`PATCH /api/courts/reservations/:id`、`DELETE /api/courts/reservations/:id`。
- 外部或基礎依賴：POSTGRES、UNKNOWN。
- 資料落點 / entity：`court_reservations`、`court_google_calendar_syncs`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`court_reservations`、`court_google_calendar_syncs`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/courts/reservations`、`PATCH /api/courts/reservations/:id`、`DELETE /api/courts/reservations/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`courts`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：supervisorSectionKey=`courts`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/courts/reservations`、`POST /api/courts/reservations`、`PATCH /api/courts/reservations/:id`、`DELETE /api/courts/reservations/:id`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `court_reservations`、`court_google_calendar_syncs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES、UNKNOWN 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /employee/courts/xinbei | employee | employee | partial |
| /employee/courts/:school | employee | employee | partial |
| /employee/courts/:school/week | employee | employee | partial |
| /employee/courts/:school/month | employee | employee | partial |
| /employee/courts/:school/search | employee | employee | partial |
| /employee/courts/:school/admin | employee | employee | partial |
| /supervisor/courts/xinbei | supervisor | supervisor | partial |
| /supervisor/courts/:school | supervisor | supervisor | partial |
| /supervisor/courts/:school/week | supervisor | supervisor | partial |
| /supervisor/courts/:school/month | supervisor | supervisor | partial |
| /supervisor/courts/:school/search | supervisor | supervisor | partial |
| /supervisor/courts/:school/admin | supervisor | supervisor | partial |
| /supervisor/courts/xinbei | system | system | partial |
| /courts/xinbei | system | legacy_admin | partial |
| /courts/sanchong | system | legacy_admin | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/courts/reservations | crud | partial |
| POST | /api/courts/reservations | crud | partial |
| PATCH | /api/courts/reservations/:id | crud | partial |
| DELETE | /api/courts/reservations/:id | crud | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | courts |

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
| court_reservations | court reservation | postgres | partial |  |
| court_google_calendar_syncs | court calendar sync state | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Reservation records and local sync state. | partial |  |
| UNKNOWN | Google Calendar sync adapter. | external |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: COURT_RESERVATION_CREATED, COURT_SYNC_RUN
- Editable by: employee, supervisor, system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Use one canonical courts module; school-specific pages remain child routes.

## Legacy

- Old names: courts-xinbei, courts-sanchong
- Old routes: /courts/:school/*
- Migration notes: 無
