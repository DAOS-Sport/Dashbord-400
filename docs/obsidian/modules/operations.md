---
module_id: operations
label: "Operations"
status: legacy
domain: derived
owner_role: system
source_of_truth: legacy
generated_at: 2026-05-18
---

# Operations

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 system, supervisor
2. RAGIC / 資料庫：不使用 Ragic；資料源為 legacy
3. 功能 / 需求 / 用途：Legacy cross-facility operations dashboard. 狀態：legacy / 相容層。

## Registry Snapshot

- Module ID: `operations`
- Status: legacy / 相容層
- Domain: `derived`
- Source of truth: `legacy`
- Homepage widget: no
- Visibility: admin_page
- Priority: {}



## 功能邏輯

- 入口從 `/operations` 進入，依角色 system、supervisor 顯示。
- 讀取透過 `GET /api/admin/overview`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：SMART_SCHEDULE_MANAGER。
- 資料落點 / entity：`source_snapshots`。

## 資料寫法 / 寫入規則

- 資料權威：`legacy`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- External 資料需經 adapter/proxy 正規化後進 BFF，不把外部 payload 直接暴露成 UI contract。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`/api/bff/supervisor/dashboard`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：plannedEndpoint=`/api/bff/supervisor/dashboard`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/admin/overview`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `source_snapshots` 的讀寫方向沒有繞過 owner module。
- 整合：確認 SMART_SCHEDULE_MANAGER 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /operations | system | legacy_admin | legacy |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/admin/overview | proxy | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| plannedEndpoint | /api/bff/supervisor/dashboard |

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
| source_snapshots | external operations payload | external | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| SMART_SCHEDULE_MANAGER | Legacy operations overview proxy. | external |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: system
- Readonly for: supervisor
- Requires approval: no
- Governance notes: Keep route registered; new operations work should move through supervisor/system BFF.

## Legacy

- Old names: 無
- Old routes: /operations, /api/admin/overview
- Migration notes: 無
