---
module_id: lane-rentals
label: "Lane Rentals"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Lane Rentals

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：松山水道租借管理 for lane booking, renter details, and operational status. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `lane-rentals`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, admin_page
- Priority: {"supervisor":11}



## 功能邏輯

- 入口從 `/supervisor/lane-rentals`、`/supervisor/lane-rentals`、`/admin/lane-rentals` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/lane-rentals`。
- 寫入透過 `POST /api/lane-rentals`、`PATCH /api/lane-rentals/:id`、`DELETE /api/lane-rentals/:id`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`lane_rentals`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`lane_rentals`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/lane-rentals`、`PATCH /api/lane-rentals/:id`、`DELETE /api/lane-rentals/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`laneRentals`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：supervisorSectionKey=`laneRentals`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/lane-rentals`、`POST /api/lane-rentals`、`PATCH /api/lane-rentals/:id`、`DELETE /api/lane-rentals/:id`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `lane_rentals` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor/lane-rentals | supervisor | supervisor | implemented |
| /supervisor/lane-rentals | system | system | implemented |
| /admin/lane-rentals | system | legacy_admin | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/lane-rentals | crud | implemented |
| POST | /api/lane-rentals | crud | implemented |
| PATCH | /api/lane-rentals/:id | crud | implemented |
| DELETE | /api/lane-rentals/:id | crud | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | laneRentals |

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
| lane_rentals | lane rental | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Lane rental CRUD and conflict checks. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: LANE_RENTAL_CREATED, LANE_RENTAL_UPDATED
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: 松山水道事項以此 canonical module id 註冊；頁面只作 route.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
