---
module_id: lifeguard-home
label: "救生首頁"
status: partial
domain: derived
owner_role: supervisor
source_of_truth: projection
generated_at: 2026-05-18
---

# 救生首頁

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 lifeguard
2. RAGIC / 資料庫：不使用 Ragic；資料源為 projection
3. 功能 / 需求 / 用途：Lifeguard operation home with six mobile-first module cards and daily record summary. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `lifeguard-home`
- Status: partial / 部分接線
- Domain: `derived`
- Source of truth: `projection`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page
- Priority: {"lifeguard":1}



## 功能邏輯

- 入口從 `/lifeguard`、`/lifeguard/home` 進入，依角色 lifeguard 顯示。
- 讀取透過 `GET /api/bff/lifeguard/home`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`lifeguard_*`、`daily_report_submissions`。

## 資料寫法 / 寫入規則

- 資料權威：`projection`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`lifeguard_*`、`daily_report_submissions`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`lifeguardHome`、`/api/bff/lifeguard/home`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/lifeguard/home`。
- Section key / planned endpoint：employeeSectionKey=`lifeguardHome`、plannedEndpoint=`/api/bff/lifeguard/home`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `lifeguard_*`、`daily_report_submissions` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /lifeguard | lifeguard | lifeguard | implemented |
| /lifeguard/home | lifeguard | lifeguard | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/lifeguard/home | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | lifeguardHome |
| plannedEndpoint | /api/bff/lifeguard/home |

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
| lifeguard_* | lifeguard daily operation summaries | postgres | partial |  |
| daily_report_submissions | lifeguard work-log summary | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Lifeguard home projection and operation counts. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: lifeguard, supervisor, system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Desktop structure and mobile operation entry share the same module config.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
