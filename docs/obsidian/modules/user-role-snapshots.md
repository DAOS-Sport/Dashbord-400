---
module_id: user-role-snapshots
label: "User Role Snapshots"
status: partial
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: postgres
generated_at: 2026-05-18
---

# User Role Snapshots

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：RAGIC：Source of employee role/facility state.
3. 功能 / 需求 / 用途：Captured role/facility/permission snapshots from HR or system authority. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `user-role-snapshots`
- Status: partial / 部分接線
- Domain: `system`
- Source of truth: `postgres`
- Homepage widget: no
- Visibility: background_only, system_only
- Priority: {}



## 功能邏輯

- 沒有獨立前端入口；由 BFF、背景工作或其他模組引用。
- 讀取透過 `GET /api/auth/me`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：RAGIC。
- 資料落點 / entity：`user_role_snapshots`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`user_role_snapshots`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：system governance surface；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`userRoleSnapshots`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：systemSectionKey=`userRoleSnapshots`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 system governance surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `user_role_snapshots` 的讀寫方向沒有繞過 owner module。
- 整合：確認 RAGIC 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

_沒有 route 綁定_

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/auth/me | auth | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | userRoleSnapshots |

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
| user_role_snapshots | user role snapshot | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| RAGIC | Source of employee role/facility state. | external |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: 未登記
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Snapshots are supporting evidence, not an employee-editable surface.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
