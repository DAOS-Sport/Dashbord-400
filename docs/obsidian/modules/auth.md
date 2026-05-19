---
module_id: auth
label: "Authentication and Session"
status: implemented
domain: core
owner_role: SYSTEM_ADMIN
source_of_truth: postgres
generated_at: 2026-05-18
---

# Authentication and Session

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 employee, lifeguard, supervisor, system, SYSTEM_ADMIN
2. RAGIC / 資料庫：RAGIC：Employee auth and H05 OT facility candidate lookup.
3. 功能 / 需求 / 用途：Workbench login, role/facility switching, legacy Ragic portal login, and session governance. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `auth`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: no
- Visibility: background_only, system_only
- Priority: {}



## 功能邏輯

- 入口從 `/portal/login`、`/login` 進入，依角色 employee、lifeguard、supervisor、system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/auth/me`、`GET /api/auth/facility-candidates`。
- 寫入透過 `POST /api/auth/login`、`POST /api/auth/logout`、`POST /api/auth/active-facility`、`POST /api/auth/active-role`、`POST /api/auth/ragic-login`。
- 外部或基礎依賴：RAGIC、LOCAL_STORAGE、POSTGRES。
- 資料落點 / entity：`users`、`sessions_index`、`auth_audit_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`users`、`sessions_index`、`auth_audit_logs`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/auth/login`、`POST /api/auth/logout`、`POST /api/auth/active-facility`、`POST /api/auth/active-role`、`POST /api/auth/ragic-login`。

## UI/UX 邏輯

- Surface model：system governance surface；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`auth`、`/api/auth/me`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：systemSectionKey=`auth`、plannedEndpoint=`/api/auth/me`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 system governance surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `users`、`sessions_index`、`auth_audit_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 RAGIC、LOCAL_STORAGE、POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /portal/login | employee | legacy_portal | partial |
| /login | system | system | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| POST | /api/auth/login | auth | implemented |
| POST | /api/auth/logout | auth | implemented |
| GET | /api/auth/me | auth | implemented |
| GET | /api/auth/facility-candidates | auth | partial |
| POST | /api/auth/active-facility | auth | implemented |
| POST | /api/auth/active-role | auth | implemented |
| POST | /api/auth/ragic-login | auth | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | auth |
| plannedEndpoint | /api/auth/me |

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
| users | legacy user credential | postgres | legacy | Original user table still exists for compatibility. |
| sessions_index | session index | postgres | partial | Session index schema exists; cookie/session hardening is still in progress. |
| auth_audit_logs | auth audit log | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| RAGIC | Employee auth and H05 OT facility candidate lookup. | external |  |
| LOCAL_STORAGE | Former portal auth hint; not a source of truth. | legacy | Do not use localStorage as authority. |
| POSTGRES | Session, user, and audit tables. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: login, logout, role_switch, facility_switch
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: yes
- Governance notes: Authentication policy is system-governed; legacy Ragic login remains registered until migration is complete.

## Legacy

- Old names: 無
- Old routes: /portal/login, /api/auth/ragic-login
- Migration notes: Keep legacy portal route while workbench session becomes the single authority.
