---
module_id: counter-log
label: "Counter Log"
status: partial
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Counter Log

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Canonical counter work-log module for daily templates, assigned tasks, recurring tasks, and supervisor review. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `counter-log`
- Status: partial / 部分接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, admin_page
- Priority: {"supervisor":10}



## 功能邏輯

- 入口從 `/supervisor/counter-log/submissions`、`/supervisor/counter-log/daily-templates`、`/supervisor/counter-log/assigned-tasks`、`/supervisor/counter-log/recurring-templates`、`/supervisor/counter-log/submissions`、`/admin/counter-logs/daily-templates`、`/admin/counter-logs/assigned-tasks`、`/admin/counter-logs/recurring-templates`、`/admin/counter-logs/submissions` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/work-logs/today`、`GET /api/admin/work-logs/templates`、`GET /api/admin/work-logs/submissions`。
- 寫入透過 `POST /api/work-logs/handover`。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`work_log_templates`、`work_log_entries`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`work_log_templates`、`work_log_entries`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/work-logs/handover`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`counterLog`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：supervisorSectionKey=`counterLog`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/work-logs/today`、`POST /api/work-logs/handover`、`GET /api/admin/work-logs/templates`、`GET /api/admin/work-logs/submissions`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `work_log_templates`、`work_log_entries` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor/counter-log/submissions | supervisor | supervisor | partial |
| /supervisor/counter-log/daily-templates | supervisor | supervisor | partial |
| /supervisor/counter-log/assigned-tasks | supervisor | supervisor | partial |
| /supervisor/counter-log/recurring-templates | supervisor | supervisor | partial |
| /supervisor/counter-log/submissions | system | system | partial |
| /admin/counter-logs/daily-templates | system | legacy_admin | partial |
| /admin/counter-logs/assigned-tasks | system | legacy_admin | partial |
| /admin/counter-logs/recurring-templates | system | legacy_admin | partial |
| /admin/counter-logs/submissions | system | legacy_admin | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/work-logs/today | crud | partial |
| POST | /api/work-logs/handover | crud | partial |
| GET | /api/admin/work-logs/templates | crud | partial |
| GET | /api/admin/work-logs/submissions | crud | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | counterLog |

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
| work_log_templates | counter log template | postgres | implemented | Uses moduleType=counter instead of a separate counter table. |
| work_log_entries | counter log entry | postgres | implemented | Counter work is separated by moduleType. |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Counter daily work-log storage and review trail. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: COUNTER_LOG_CREATED, COUNTER_LOG_UPDATED
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: 櫃台畫面沿用 supervisor/counter 工作面；不新增 counter role.

## Legacy

- Old names: counter-logs
- Old routes: /admin/counter-logs/*
- Migration notes: Canonical module id is counter-log; individual admin pages are child routes.
