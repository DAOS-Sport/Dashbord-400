---
module_id: integration-sync-jobs
label: "Integration Sync Jobs"
status: legacy
domain: integration
owner_role: SYSTEM_ADMIN
source_of_truth: telemetry
generated_at: 2026-05-18
---

# Integration Sync Jobs

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：RAGIC：Future sync status source.
3. 功能 / 需求 / 用途：Integration status source retained under system-watchdog integrations. 狀態：legacy / 相容層。

## Registry Snapshot

- Module ID: `integration-sync-jobs`
- Status: legacy / 相容層
- Domain: `integration`
- Source of truth: `telemetry`
- Homepage widget: no
- Visibility: background_only, system_only
- Priority: {}



## 功能邏輯

- 入口從 `/system/integrations` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/integration-overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：LINE_BOT_ASSISTANT、SMART_SCHEDULE_MANAGER、RAGIC。
- 資料落點 / entity：`integration_error_logs`、`sync_job_runs`、`source_snapshots`。

## 資料寫法 / 寫入規則

- 資料權威：`telemetry`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`integration_error_logs`、`sync_job_runs`。
- External 資料需經 adapter/proxy 正規化後進 BFF，不把外部 payload 直接暴露成 UI contract。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：system governance surface；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`integrationOverview`、`/api/bff/system/integration-overview`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/integration-overview`。
- Section key / planned endpoint：systemSectionKey=`integrationOverview`、plannedEndpoint=`/api/bff/system/integration-overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 system governance surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `integration_error_logs`、`sync_job_runs`、`source_snapshots` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT、SMART_SCHEDULE_MANAGER、RAGIC 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/integrations | system | system | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/integration-overview | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | integrationOverview |
| plannedEndpoint | /api/bff/system/integration-overview |

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
| integration_error_logs | integration error log | telemetry | planned |  |
| sync_job_runs | sync job run | telemetry | planned |  |
| source_snapshots | source snapshot | external | planned |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | Future sync status source. | planned |  |
| SMART_SCHEDULE_MANAGER | Future sync status source. | planned |  |
| RAGIC | Future sync status source. | planned |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: 未登記
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Planned registry entry for sync observability; no mutating sync runner is added in this round.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
