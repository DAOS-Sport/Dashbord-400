---
module_id: hr-audit
label: "HR Audit"
status: partial
domain: support
owner_role: SYSTEM_ADMIN
source_of_truth: external
generated_at: 2026-05-18
---

# HR Audit

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：RAGIC：Employee status and HR truth.
3. 功能 / 需求 / 用途：HR and permission audit placeholder tied to Ragic employee authority and schedule signals. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `hr-audit`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `external`
- Homepage widget: no
- Visibility: admin_page, system_only
- Priority: {}



## 功能邏輯

- 入口從 `/hr-audit` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/admin/interview-users`。
- 寫入透過 `POST /api/hr-audit`。
- 外部或基礎依賴：RAGIC、SMART_SCHEDULE_MANAGER。
- 資料落點 / entity：`user_role_snapshots`、`auth_audit_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`user_role_snapshots`、`auth_audit_logs`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/hr-audit`。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`audit`、`/api/hr-audit`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：systemSectionKey=`audit`、plannedEndpoint=`/api/hr-audit`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/admin/interview-users`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `user_role_snapshots`、`auth_audit_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 RAGIC、SMART_SCHEDULE_MANAGER 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /hr-audit | system | legacy_admin | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| POST | /api/hr-audit | legacy | partial |
| GET | /api/admin/interview-users | proxy | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | audit |
| plannedEndpoint | /api/hr-audit |

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
| user_role_snapshots | role grant snapshots | postgres | partial |  |
| auth_audit_logs | auth audit log | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| RAGIC | Employee status and HR truth. | external |  |
| SMART_SCHEDULE_MANAGER | Interview users and schedule-side HR signals. | external |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: hr_audit
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: yes
- Governance notes: HR audit write behavior is not fully implemented yet.

## Legacy

- Old names: 無
- Old routes: /hr-audit, /api/hr-audit
- Migration notes: 無
