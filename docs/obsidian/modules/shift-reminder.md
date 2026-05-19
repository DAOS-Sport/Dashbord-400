---
module_id: shift-reminder
label: "Shift Reminder"
status: partial
domain: integration
owner_role: system
source_of_truth: external
generated_at: 2026-05-18
---

# Shift Reminder

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 employee, lifeguard, supervisor
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Today shift and reminder section from Smart Schedule Manager and facility-home proxy. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `shift-reminder`
- Status: partial / 部分接線
- Domain: `integration`
- Source of truth: `external`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, portal_page
- Priority: {"employee":7,"supervisor":7}



## 功能邏輯

- 入口從 `/portal/:facilityKey/shift`、`/employee/shift` 進入，依角色 employee、lifeguard、supervisor 顯示。
- 讀取透過 `GET /api/facility-home/:groupId/today-shift`、`GET /api/bff/employee/shifts/today`、`GET /api/bff/system/schedule-snapshot`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：SMART_SCHEDULE_MANAGER、LINE_BOT_ASSISTANT。
- 資料落點 / entity：`source_snapshots`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- External 資料需經 adapter/proxy 正規化後進 BFF，不把外部 payload 直接暴露成 UI contract。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`shifts`、`shifts`、`scheduleSnapshot`、`/api/bff/system/schedule-snapshot`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/employee/shifts/today`、`GET /api/bff/system/schedule-snapshot`。
- Section key / planned endpoint：employeeSectionKey=`shifts`、supervisorSectionKey=`shifts`、systemSectionKey=`scheduleSnapshot`、plannedEndpoint=`/api/bff/system/schedule-snapshot`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/facility-home/:groupId/today-shift`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `source_snapshots` 的讀寫方向沒有繞過 owner module。
- 整合：確認 SMART_SCHEDULE_MANAGER、LINE_BOT_ASSISTANT 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /portal/:facilityKey/shift | employee | legacy_portal | legacy |
| /employee/shift | employee | employee | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/facility-home/:groupId/today-shift | proxy | legacy |
| GET | /api/bff/employee/shifts/today | bff | partial |
| GET | /api/bff/system/schedule-snapshot | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | shifts |
| supervisorSectionKey | shifts |
| systemSectionKey | scheduleSnapshot |
| plannedEndpoint | /api/bff/system/schedule-snapshot |

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
| source_snapshots | schedule source snapshot | external | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| SMART_SCHEDULE_MANAGER | Canonical shift export and schedule snapshot. | external |  |
| LINE_BOT_ASSISTANT | Legacy facility-home today-shift proxy. | legacy |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: system
- Readonly for: employee, supervisor
- Requires approval: no
- Governance notes: Schedule data should enter through adapter/projection, not direct frontend calls.

## Legacy

- Old names: 無
- Old routes: /portal/:facilityKey/shift, /api/facility-home/:groupId/today-shift
- Migration notes: 無
