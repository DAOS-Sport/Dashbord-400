---
module_id: supervisor-lifeguard-overview
label: "救生紀錄總覽"
status: partial
domain: support
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# 救生紀錄總覽

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Supervisor observer view for lifeguard water quality, coach dive, cleanup, lane issues, and lost-and-found records. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `supervisor-lifeguard-overview`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: detail_page
- Priority: {"supervisor":10}



## 功能邏輯

- 入口從 `/supervisor/lifeguard-overview` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/bff/supervisor/lifeguard-overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`lifeguard_water_quality_logs`、`lifeguard_coach_dive_logs`、`lifeguard_cleanup_logs`、`lifeguard_lost_and_found`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`lifeguard_water_quality_logs`、`lifeguard_coach_dive_logs`、`lifeguard_cleanup_logs`、`lifeguard_lost_and_found`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：role detail page；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`lifeguardOverview`、`/api/bff/supervisor/lifeguard-overview`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/supervisor/lifeguard-overview`。
- Section key / planned endpoint：supervisorSectionKey=`lifeguardOverview`、plannedEndpoint=`/api/bff/supervisor/lifeguard-overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 role detail page 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `lifeguard_water_quality_logs`、`lifeguard_coach_dive_logs`、`lifeguard_cleanup_logs`、`lifeguard_lost_and_found` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor/lifeguard-overview | supervisor | supervisor | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/supervisor/lifeguard-overview | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | lifeguardOverview |
| plannedEndpoint | /api/bff/supervisor/lifeguard-overview |

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
| lifeguard_water_quality_logs | water quality records | postgres | partial |  |
| lifeguard_coach_dive_logs | coach dive records | postgres | partial |  |
| lifeguard_cleanup_logs | cleanup records | postgres | partial |  |
| lifeguard_lost_and_found | lost item records | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Supervisor lifeguard observer aggregation. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: supervisor, system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Observer view may claim/dispose lost items through the canonical lost-and-found API.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
