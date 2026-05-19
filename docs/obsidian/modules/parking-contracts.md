---
module_id: parking-contracts
label: "Parking Contracts"
status: implemented
domain: core
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# Parking Contracts

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Parking contracts, staff-issued signing links, electronic signatures, PDF contract generation state, renewal, termination, and refund records. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `parking-contracts`
- Status: implemented / 已接線
- Domain: `core`
- Source of truth: `postgres`
- Homepage widget: no
- Visibility: detail_page, admin_page
- Priority: {}



## 功能邏輯

- 入口從 `/supervisor/parking/contracts`、`/supervisor/parking/contracts`、`/admin/parking/contracts`、`/parking/sign/:token` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/parking/contracts`、`GET /api/parking/sign-tokens/:token`。
- 寫入透過 `POST /api/parking/contracts`、`PATCH /api/parking/contracts/:id`、`POST /api/parking/contracts/:id/sign`、`POST /api/parking/contracts/:id/issue-sign-link`、`POST /api/parking/contracts/:id/terminate`、`POST /api/parking/contracts/:id/refund`、`POST /api/parking/sign-tokens/:token/finalize`。
- 外部或基礎依賴：POSTGRES、OBJECT_STORAGE。
- 資料落點 / entity：`parking_contracts`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`parking_contracts`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/parking/contracts`、`PATCH /api/parking/contracts/:id`、`POST /api/parking/contracts/:id/sign`、`POST /api/parking/contracts/:id/issue-sign-link`、`POST /api/parking/contracts/:id/terminate`、`POST /api/parking/contracts/:id/refund`、`POST /api/parking/sign-tokens/:token/finalize`。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`parkingContracts`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：supervisorSectionKey=`parkingContracts`。
- 寫入後 BFF 需要刷新或重算的 CRUD endpoint：`GET /api/parking/contracts`、`POST /api/parking/contracts`、`PATCH /api/parking/contracts/:id`、`POST /api/parking/contracts/:id/sign`、`POST /api/parking/contracts/:id/issue-sign-link`、`POST /api/parking/contracts/:id/terminate`、`POST /api/parking/contracts/:id/refund`、`GET /api/parking/sign-tokens/:token`、`POST /api/parking/sign-tokens/:token/finalize`。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `parking_contracts` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES、OBJECT_STORAGE 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /supervisor/parking/contracts | supervisor | supervisor | implemented |
| /supervisor/parking/contracts | system | system | implemented |
| /admin/parking/contracts | system | legacy_admin | implemented |
| /parking/sign/:token | - | external | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/parking/contracts | crud | implemented |
| POST | /api/parking/contracts | crud | implemented |
| PATCH | /api/parking/contracts/:id | crud | implemented |
| POST | /api/parking/contracts/:id/sign | crud | implemented |
| POST | /api/parking/contracts/:id/issue-sign-link | crud | implemented |
| POST | /api/parking/contracts/:id/terminate | crud | implemented |
| POST | /api/parking/contracts/:id/refund | crud | implemented |
| GET | /api/parking/sign-tokens/:token | crud | implemented |
| POST | /api/parking/sign-tokens/:token/finalize | crud | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | parkingContracts |

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
| parking_contracts | parking contract | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Contract lifecycle, status, sign token hash and PDF metadata. | implemented |  |
| OBJECT_STORAGE | Signature image and generated contract artifacts. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: PARKING_CONTRACT_CREATED, PARKING_CONTRACT_SIGNED
- Editable by: supervisor, system
- Readonly for: employee
- Requires approval: no
- Governance notes: Signing token is staff-issued; not a standalone public member portal in this phase.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
