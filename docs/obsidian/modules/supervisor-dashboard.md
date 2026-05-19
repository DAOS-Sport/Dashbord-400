---
module_id: supervisor-dashboard
label: "主管儀表板"
status: partial
domain: derived
owner_role: supervisor
source_of_truth: projection
generated_at: 2026-05-18
---

# 主管儀表板

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor
2. RAGIC / 資料庫：不使用 Ragic；資料源為 projection
3. 功能 / 需求 / 用途：Supervisor workbench dashboard for operations overview, facility cards, module preview drawers, and review counts. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `supervisor-dashboard`
- Status: partial / 部分接線
- Domain: `derived`
- Source of truth: `projection`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page
- Priority: {"supervisor":1}



## 功能邏輯

- 入口從 `/supervisor`、`/supervisor/home` 進入，依角色 supervisor 顯示。
- 讀取透過 `GET /api/bff/supervisor/dashboard`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`supervisor_dashboard_projection`。

## 資料寫法 / 寫入規則

- 資料權威：`projection`。
- 沒有 Postgres 寫入權威登記。
- Projection 資料只能由 BFF / sync job 重建或更新，頁面不得自行當作權威：`supervisor_dashboard_projection`。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`dashboard`、`/api/bff/supervisor/dashboard`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/supervisor/dashboard`。
- Section key / planned endpoint：supervisorSectionKey=`dashboard`、plannedEndpoint=`/api/bff/supervisor/dashboard`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `supervisor_dashboard_projection` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor | supervisor | supervisor | implemented |
| /supervisor/home | supervisor | supervisor | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/supervisor/dashboard | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | dashboard |
| plannedEndpoint | /api/bff/supervisor/dashboard |

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
| supervisor_dashboard_projection | supervisor dashboard projection | projection | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Supervisor dashboard projection and module previews. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: supervisor, system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Supervisor dashboard is the official shell entry; legacy admin dashboard redirects away.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
