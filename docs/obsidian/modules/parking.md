---
module_id: parking
label: "Parking Management"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Parking Management

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：停車場會員與租約管理總入口 for dashboard KPIs, staff-driven lease creation, signing, payment review, and event days. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `parking`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, admin_page
- Priority: {"supervisor":9}



## 功能邏輯

- 入口從 `/supervisor/parking`、`/supervisor/parking`、`/admin/parking/dashboard` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/parking/dashboard`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES、OBJECT_STORAGE、GMAIL_SMTP、UNKNOWN。
- 資料落點 / entity：`parking_vehicles`、`parking_contracts`、`parking_payments`、`parking_event_days`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`parking_vehicles`、`parking_contracts`、`parking_payments`、`parking_event_days`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`parking`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：supervisorSectionKey=`parking`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/parking/dashboard`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `parking_vehicles`、`parking_contracts`、`parking_payments`、`parking_event_days` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES、OBJECT_STORAGE、GMAIL_SMTP、UNKNOWN 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor/parking | supervisor | supervisor | implemented |
| /supervisor/parking | system | system | implemented |
| /admin/parking/dashboard | system | legacy_admin | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/parking/dashboard | crud | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | parking |

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
| parking_vehicles | parking vehicle | postgres | implemented |  |
| parking_contracts | parking contract | postgres | implemented |  |
| parking_payments | parking payment | postgres | implemented |  |
| parking_event_days | parking event day | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Parking lease, vehicle, payment, event-day and signing data. | implemented |  |
| OBJECT_STORAGE | Signature image and payment screenshot storage. | partial |  |
| GMAIL_SMTP | First-phase parking notification delivery. | planned |  |
| UNKNOWN | Future LINE Messaging API via stored lineUserId. | planned |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=yes
- Event types: PARKING_DASHBOARD_VIEW
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: 第一版只給主管與櫃台內部操作；公開查詢/續約入口延後.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
