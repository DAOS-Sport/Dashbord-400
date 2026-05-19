---
module_id: portal-home
label: "Portal Home"
status: legacy
domain: legacy
owner_role: system
source_of_truth: external
generated_at: 2026-05-18
---

# Portal Home

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 employee, lifeguard
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Legacy facility portal home and employee home data migration boundary. 狀態：legacy / 相容層。

## Registry Snapshot

- Module ID: `portal-home`
- Status: legacy / 相容層
- Domain: `legacy`
- Source of truth: `external`
- Homepage widget: yes
- Visibility: homepage_widget, portal_page
- Priority: {"employee":13}



## 功能邏輯

- 入口從 `/portal`、`/portal/:facilityKey` 進入，依角色 employee、lifeguard 顯示。
- 讀取透過 `GET /api/facility-home/:groupId/home`、`GET /api/bff/employee/home`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：LINE_BOT_ASSISTANT。
- 資料落點 / entity：`employee_home_projection`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- 沒有 Postgres 寫入權威登記。
- Projection 資料只能由 BFF / sync job 重建或更新，頁面不得自行當作權威：`employee_home_projection`。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`home`、`/api/bff/employee/home`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/employee/home`。
- Section key / planned endpoint：employeeSectionKey=`home`、plannedEndpoint=`/api/bff/employee/home`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/facility-home/:groupId/home`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `employee_home_projection` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /portal | employee | legacy_portal | legacy |
| /portal/:facilityKey | employee | legacy_portal | legacy |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/facility-home/:groupId/home | proxy | legacy |
| GET | /api/bff/employee/home | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | home |
| plannedEndpoint | /api/bff/employee/home |

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

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | Legacy facility-home payload. | legacy |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: pageview, widget_click
- Editable by: system
- Readonly for: employee
- Requires approval: no
- Governance notes: Legacy portal remains registered; new employee home should consume BFF.

## Legacy

- Old names: 無
- Old routes: /portal, /portal/:facilityKey, /api/facility-home/:groupId/home
- Migration notes: 無
