---
module_id: schedule-integration
label: "Smart Schedule Integration"
status: partial
domain: integration
owner_role: system
source_of_truth: external
generated_at: 2026-05-18
---

# Smart Schedule Integration

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 system, supervisor, employee, lifeguard
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Smart Schedule Manager adapter, admin overview proxy, and normalized schedule snapshot. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `schedule-integration`
- Status: partial / 部分接線
- Domain: `integration`
- Source of truth: `external`
- Homepage widget: no
- Visibility: background_only, system_only
- Priority: {}



## 功能邏輯

- 沒有獨立前端入口；由 BFF、背景工作或其他模組引用。
- 讀取透過 `GET /api/admin/overview`、`GET /api/admin/interview-users`、`GET /api/bff/system/schedule-snapshot`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：SMART_SCHEDULE_MANAGER。
- 資料落點 / entity：`source_snapshots`、`sync_job_runs`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`sync_job_runs`。
- External 資料需經 adapter/proxy 正規化後進 BFF，不把外部 payload 直接暴露成 UI contract。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：system governance surface；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`shifts`、`staffing`、`scheduleSnapshot`、`/api/bff/system/schedule-snapshot`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/schedule-snapshot`。
- Section key / planned endpoint：employeeSectionKey=`shifts`、supervisorSectionKey=`staffing`、systemSectionKey=`scheduleSnapshot`、plannedEndpoint=`/api/bff/system/schedule-snapshot`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/admin/overview`、`GET /api/admin/interview-users`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 system governance surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `source_snapshots`、`sync_job_runs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 SMART_SCHEDULE_MANAGER 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

_沒有 route 綁定_

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/admin/overview | proxy | legacy |
| GET | /api/admin/interview-users | proxy | legacy |
| GET | /api/bff/system/schedule-snapshot | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | shifts |
| supervisorSectionKey | staffing |
| systemSectionKey | scheduleSnapshot |
| plannedEndpoint | /api/bff/system/schedule-snapshot |

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
| source_snapshots | schedule snapshot | external | partial |  |
| sync_job_runs | schedule sync job | telemetry | planned |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| SMART_SCHEDULE_MANAGER | Schedule export, staffing, shift reminder, and assignee matching. | external |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: 未登記
- Editable by: system
- Readonly for: employee, supervisor
- Requires approval: no
- Governance notes: Schedule truth must stay behind adapter/BFF boundaries.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
