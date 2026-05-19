---
module_id: bff-projections
label: "BFF Projections"
status: partial
domain: derived
owner_role: system
source_of_truth: projection
generated_at: 2026-05-18
---

# BFF Projections

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：不使用 Ragic；資料源為 projection
3. 功能 / 需求 / 用途：Projection tables that back employee, supervisor, and system BFF responses. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `bff-projections`
- Status: partial / 部分接線
- Domain: `derived`
- Source of truth: `projection`
- Homepage widget: no
- Visibility: background_only, system_only
- Priority: {}



## 功能邏輯

- 沒有獨立前端入口；由 BFF、背景工作或其他模組引用。
- 讀取透過 `GET /api/bff/employee/home`、`GET /api/bff/supervisor/dashboard`、`GET /api/bff/system/overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES、LINE_BOT_ASSISTANT、SMART_SCHEDULE_MANAGER。
- 資料落點 / entity：`employee_home_projection`、`supervisor_dashboard_projection`、`system_overview_projection`。

## 資料寫法 / 寫入規則

- 資料權威：`projection`。
- 沒有 Postgres 寫入權威登記。
- Projection 資料只能由 BFF / sync job 重建或更新，頁面不得自行當作權威：`employee_home_projection`、`supervisor_dashboard_projection`、`system_overview_projection`。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：system governance surface；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`home`、`dashboard`、`overview`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- 未登記 UI telemetry；新增互動前需判斷是否需要 page/action/card 事件。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/employee/home`、`GET /api/bff/supervisor/dashboard`、`GET /api/bff/system/overview`。
- Section key / planned endpoint：employeeSectionKey=`home`、supervisorSectionKey=`dashboard`、systemSectionKey=`overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 system governance surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `employee_home_projection`、`supervisor_dashboard_projection`、`system_overview_projection` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES、LINE_BOT_ASSISTANT、SMART_SCHEDULE_MANAGER 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

_沒有 route 綁定_

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/employee/home | bff | partial |
| GET | /api/bff/supervisor/dashboard | bff | partial |
| GET | /api/bff/system/overview | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | home |
| supervisorSectionKey | dashboard |
| systemSectionKey | overview |

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
| employee_home_projection | employee home projection | projection | partial |  |
| supervisor_dashboard_projection | supervisor dashboard projection | projection | partial |  |
| system_overview_projection | system overview projection | projection | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Projection persistence. | partial |  |
| LINE_BOT_ASSISTANT | Projection source/fallback. | external |  |
| SMART_SCHEDULE_MANAGER | Projection source/fallback. | external |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=no
- Event types: bff_projection_refresh, bff_cache_miss
- Editable by: system
- Readonly for: employee, supervisor
- Requires approval: no
- Governance notes: BFF projection tables are derived state; source truth stays in source systems or local domain tables.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
