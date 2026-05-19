---
module_id: telemetry-audit
label: "Telemetry and Audit"
status: legacy
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: telemetry
generated_at: 2026-05-18
---

# Telemetry and Audit

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：不使用 Ragic；資料源為 telemetry
3. 功能 / 需求 / 用途：Legacy telemetry/audit entry retained under the Governance audit tab. 狀態：legacy / 相容層。

## Registry Snapshot

- Module ID: `telemetry-audit`
- Status: legacy / 相容層
- Domain: `system`
- Source of truth: `telemetry`
- Homepage widget: no
- Visibility: background_only, system_only, admin_page
- Priority: {}



## 功能邏輯

- 入口從 `/system/audit` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/ui-event-overview`、`GET /api/portal/analytics`。
- 寫入透過 `POST /api/telemetry/ui-events`、`POST /api/telemetry/client-error`、`POST /api/portal/events`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`ui_events`、`audit_logs`、`portal_events`、`bff_latency_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`telemetry`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`ui_events`、`audit_logs`、`portal_events`、`bff_latency_logs`。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/telemetry/ui-events`、`POST /api/telemetry/client-error`、`POST /api/portal/events`。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`audit`、`/api/bff/system/ui-event-overview`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/ui-event-overview`。
- Section key / planned endpoint：systemSectionKey=`audit`、plannedEndpoint=`/api/bff/system/ui-event-overview`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `ui_events`、`audit_logs`、`portal_events`、`bff_latency_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/audit | system | system | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| POST | /api/telemetry/ui-events | telemetry | implemented |
| POST | /api/telemetry/client-error | telemetry | implemented |
| GET | /api/bff/system/ui-event-overview | bff | partial |
| POST | /api/portal/events | telemetry | legacy |
| GET | /api/portal/analytics | telemetry | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | audit |
| plannedEndpoint | /api/bff/system/ui-event-overview |

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
| ui_events | UI event | telemetry | implemented |  |
| audit_logs | audit log | telemetry | partial |  |
| portal_events | portal event | telemetry | implemented |  |
| bff_latency_logs | BFF latency log | telemetry | planned |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Telemetry/audit tables. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: CARD_CLICK, CLIENT_ERROR_REPORTED
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Audit writer exists but high-risk business writes still need full coverage.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
