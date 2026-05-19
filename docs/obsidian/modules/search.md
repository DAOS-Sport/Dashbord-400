---
module_id: search
label: "快速搜尋"
status: partial
domain: support
owner_role: system
source_of_truth: projection
generated_at: 2026-05-18
---

# 快速搜尋

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 employee, lifeguard, supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 projection
3. 功能 / 需求 / 用途：Global workbench search over registered modules, announcements, handovers, shifts, entry points, and common questions. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `search`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `projection`
- Homepage widget: yes
- Visibility: homepage_widget, background_only
- Priority: {"employee":30,"lifeguard":30,"supervisor":30,"system":30}



## 功能邏輯

- 入口從 `/supervisor/facilities`、`/supervisor/facilities/:facilityKey`、`/supervisor/people` 進入，依角色 employee、lifeguard、supervisor、system 顯示。
- 讀取透過 `GET /api/search/global`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`MODULE_REGISTRY`。

## 資料寫法 / 寫入規則

- 資料權威：`projection`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`search`、`search`、`search`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：action submit。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/search/global`。
- Section key / planned endpoint：employeeSectionKey=`search`、supervisorSectionKey=`search`、systemSectionKey=`search`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `MODULE_REGISTRY` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor/facilities | supervisor | supervisor | partial |
| /supervisor/facilities/:facilityKey | supervisor | supervisor | partial |
| /supervisor/people | supervisor | supervisor | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/search/global | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | search |
| supervisorSectionKey | search |
| systemSectionKey | search |

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
| MODULE_REGISTRY | search index seed | private | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Searchable workbench content once full-text projection is wired. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=yes；auditRequired=no
- Event types: SEARCH_SUBMIT
- Editable by: system
- Readonly for: employee, lifeguard, supervisor
- Requires approval: no
- Governance notes: Search is a shared background capability, not a dedicated route.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
