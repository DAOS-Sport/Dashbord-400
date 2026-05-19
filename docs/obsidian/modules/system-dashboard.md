---
module_id: system-dashboard
label: "系統總覽"
status: legacy
domain: system
owner_role: system
source_of_truth: projection
generated_at: 2026-05-18
---

# 系統總覽

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：不使用 Ragic；資料源為 projection
3. 功能 / 需求 / 用途：Legacy system overview entry retained behind the new five-entry control center. 狀態：legacy / 相容層。

## Registry Snapshot

- Module ID: `system-dashboard`
- Status: legacy / 相容層
- Domain: `system`
- Source of truth: `projection`
- Homepage widget: no
- Visibility: detail_page, system_only
- Priority: {}



## 功能邏輯

- 入口從 `/system`、`/system/overview` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`system_overview_projection`。

## 資料寫法 / 寫入規則

- 資料權威：`projection`。
- 沒有 Postgres 寫入權威登記。
- Projection 資料只能由 BFF / sync job 重建或更新，頁面不得自行當作權威：`system_overview_projection`。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：role detail page；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`overview`、`/api/bff/system/overview`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/overview`。
- Section key / planned endpoint：systemSectionKey=`overview`、plannedEndpoint=`/api/bff/system/overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 role detail page 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `system_overview_projection` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system | system | system | implemented |
| /system/overview | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/overview | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | overview |
| plannedEndpoint | /api/bff/system/overview |

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
| system_overview_projection | system overview projection | projection | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | System overview projection and module health summary. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=no
- Event types: MODULE_HEALTH_VIEW
- Editable by: system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Replaced in navigation by system-control-center; retained for compatibility only.

## Legacy

- Old names: 無
- Old routes: /system/overview
- Migration notes: Primary IT entry is /system via system-control-center.
