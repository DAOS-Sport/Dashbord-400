---
module_id: anomalies
label: "Anomalies"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Anomalies

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Clock-in anomaly reports, review, resolution, and system alert surfaces. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `anomalies`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, admin_page
- Priority: {"system":3}



## 功能邏輯

- 入口從 `/anomaly-reports`、`/system/alerts` 進入，依角色 system 顯示。
- 讀取透過 `GET /api/anomaly-reports`、`GET /api/anomaly-reports/:id`。
- 寫入透過 `POST /api/anomaly-report`、`PATCH /api/anomaly-reports/:id/resolution`、`PATCH /api/anomaly-reports/batch/resolution`、`DELETE /api/anomaly-reports/:id`。
- 外部或基礎依賴：GMAIL_SMTP、OBJECT_STORAGE。
- 資料落點 / entity：`anomaly_reports`、`audit_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`anomaly_reports`、`audit_logs`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/anomaly-report`、`PATCH /api/anomaly-reports/:id/resolution`、`PATCH /api/anomaly-reports/batch/resolution`、`DELETE /api/anomaly-reports/:id`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`pendingAnomalies`、`alerts`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：supervisorSectionKey=`pendingAnomalies`、systemSectionKey=`alerts`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/anomaly-reports`、`GET /api/anomaly-reports/:id`、`PATCH /api/anomaly-reports/:id/resolution`、`PATCH /api/anomaly-reports/batch/resolution`、`DELETE /api/anomaly-reports/:id`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `anomaly_reports`、`audit_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 GMAIL_SMTP、OBJECT_STORAGE 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /anomaly-reports | system | legacy_admin | implemented |
| /system/alerts | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| POST | /api/anomaly-report | upload | implemented |
| GET | /api/anomaly-reports | crud | implemented |
| GET | /api/anomaly-reports/:id | crud | implemented |
| PATCH | /api/anomaly-reports/:id/resolution | crud | implemented |
| PATCH | /api/anomaly-reports/batch/resolution | crud | implemented |
| DELETE | /api/anomaly-reports/:id | crud | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | pendingAnomalies |
| systemSectionKey | alerts |

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
| anomaly_reports | anomaly report | postgres | implemented |  |
| audit_logs | anomaly resolution audit | postgres | planned | Resolution audit write path is still planned. |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| GMAIL_SMTP | Notification email for new reports/resolution. | partial |  |
| OBJECT_STORAGE | Current upload path is local uploads; object storage is future replacement. | planned |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: 未登記
- Editable by: supervisor, system
- Readonly for: 未登記
- Requires approval: yes
- Governance notes: Anomaly resolution should fail closed into audit before production hardening.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
