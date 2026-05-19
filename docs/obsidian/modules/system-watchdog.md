---
module_id: system-watchdog
label: "Watchdog"
status: implemented
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: telemetry
generated_at: 2026-05-18
---

# Watchdog

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：不使用 Ragic；資料源為 telemetry
3. 功能 / 需求 / 用途：Unified IT health page that combines module health, watchdog alerts, and external integration status. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `system-watchdog`
- Status: implemented / 已接線
- Domain: `system`
- Source of truth: `telemetry`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, system_only
- Priority: {"system":2}



## 功能邏輯

- 入口從 `/system/watchdog` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/modules/health`、`GET /api/bff/system/watchdog-events`、`GET /api/bff/system/integration-overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES、UNKNOWN。
- 資料落點 / entity：`watchdog_events`、`integration_error_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`telemetry`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`watchdog_events`、`integration_error_logs`。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`watchdog`、`/api/bff/system/watchdog-events`、`/api/bff/system/integration-overview`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/modules/health`、`GET /api/bff/system/watchdog-events`、`GET /api/bff/system/integration-overview`。
- Section key / planned endpoint：systemSectionKey=`watchdog`、plannedEndpoint=`/api/bff/system/watchdog-events`、plannedEndpoint=`/api/bff/system/integration-overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `watchdog_events`、`integration_error_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES、UNKNOWN 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/watchdog | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/modules/health | bff | implemented |
| GET | /api/bff/system/watchdog-events | bff | implemented |
| GET | /api/bff/system/integration-overview | bff | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | watchdog |
| plannedEndpoint | /api/bff/system/watchdog-events |
| plannedEndpoint | /api/bff/system/integration-overview |

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
| watchdog_events | watchdog event stream | telemetry | implemented |  |
| integration_error_logs | integration health signals | telemetry | planned |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Watchdog events and registry health. | partial |  |
| UNKNOWN | External watchdogs can post events with internal token. | external |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: MODULE_HEALTH_VIEW, WATCHDOG_EVENT_VIEW, INTEGRATION_STATUS_VIEW
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Replaces the old health, alerts, and integrations pages in navigation.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
