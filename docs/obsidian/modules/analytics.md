---
module_id: analytics
label: "Analytics"
status: partial
domain: derived
owner_role: system
source_of_truth: telemetry
generated_at: 2026-05-18
---

# Analytics

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 telemetry
3. 功能 / 需求 / 用途：Legacy admin analytics and supervisor report surface. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `analytics`
- Status: partial / 部分接線
- Domain: `derived`
- Source of truth: `telemetry`
- Homepage widget: no
- Visibility: detail_page, admin_page
- Priority: {}



## 功能邏輯

- 入口從 `/analytics`、`/supervisor/reports` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/portal/analytics`、`GET /api/bff/system/ui-event-overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`portal_events`、`ui_events`。

## 資料寫法 / 寫入規則

- 資料權威：`telemetry`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`portal_events`、`ui_events`。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`reports`、`uiEventOverview`、`/api/bff/system/ui-event-overview`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/ui-event-overview`。
- Section key / planned endpoint：supervisorSectionKey=`reports`、systemSectionKey=`uiEventOverview`、plannedEndpoint=`/api/bff/system/ui-event-overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `portal_events`、`ui_events` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /analytics | system | legacy_admin | implemented |
| /supervisor/reports | supervisor | supervisor | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/portal/analytics | telemetry | partial |
| GET | /api/bff/system/ui-event-overview | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | reports |
| systemSectionKey | uiEventOverview |
| plannedEndpoint | /api/bff/system/ui-event-overview |

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
| portal_events | portal interaction events | telemetry | implemented |  |
| ui_events | workbench UI events | telemetry | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Analytics rollups from event tables. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: system
- Readonly for: supervisor
- Requires approval: no
- Governance notes: Analytics reads telemetry/projection state only.

## Legacy

- Old names: 無
- Old routes: /analytics
- Migration notes: Legacy analytics page is registered for coverage but should not receive new data fan-out.
