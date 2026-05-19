---
module_id: system-insights
label: "行為洞察"
status: implemented
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: telemetry
generated_at: 2026-05-18
---

# 行為洞察

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：不使用 Ragic；資料源為 telemetry
3. 功能 / 需求 / 用途：Behavior analytics for module usage, completion rates, role trends, facility trends, and time trends. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `system-insights`
- Status: implemented / 已接線
- Domain: `system`
- Source of truth: `telemetry`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, system_only
- Priority: {"system":4}



## 功能邏輯

- 入口從 `/system/insights` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/insights/overview`、`GET /api/bff/system/insights/module/:moduleId`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`ui_events`、`audit_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`telemetry`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`ui_events`、`audit_logs`。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`insights`、`/api/bff/system/insights/overview`、`/api/bff/system/insights/module/:moduleId`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/insights/overview`、`GET /api/bff/system/insights/module/:moduleId`。
- Section key / planned endpoint：systemSectionKey=`insights`、plannedEndpoint=`/api/bff/system/insights/overview`、plannedEndpoint=`/api/bff/system/insights/module/:moduleId`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `ui_events`、`audit_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/insights | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/insights/overview | bff | implemented |
| GET | /api/bff/system/insights/module/:moduleId | bff | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | insights |
| plannedEndpoint | /api/bff/system/insights/overview |
| plannedEndpoint | /api/bff/system/insights/module/:moduleId |

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
| ui_events | module behavior events | telemetry | implemented |  |
| audit_logs | completion event audit trail | telemetry | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Behavioral trend rollups from telemetry tables. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=no
- Event types: INSIGHTS_VIEW, INSIGHTS_DRILL_DOWN
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Read-only usage analytics from ui_events and selected audit completion events.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
