---
module_id: lifeguard-cleanup
label: "下班打掃"
status: partial
domain: support
owner_role: supervisor
source_of_truth: postgres
generated_at: 2026-05-18
---

# 下班打掃

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 lifeguard
2. RAGIC / 資料庫：不使用 Ragic；資料源為 postgres
3. 功能 / 需求 / 用途：Lifeguard closing cleanup GPS photo records. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `lifeguard-cleanup`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `postgres`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page
- Priority: {"lifeguard":4}



## 功能邏輯

- 入口從 `/lifeguard/cleanup`、`/lifeguard/closing-cleanup-photo` 進入，依角色 lifeguard 顯示。
- 沒有登記讀取 API；資料多半由其他 projection 或背景流程提供。
- 寫入透過 `POST /api/bff/lifeguard/cleanup`、`POST /api/bff/lifeguard/photo-upload`。
- 外部或基礎依賴：OBJECT_STORAGE。
- 資料落點 / entity：`lifeguard_cleanup_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`postgres`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`lifeguard_cleanup_logs`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/bff/lifeguard/cleanup`、`POST /api/bff/lifeguard/photo-upload`。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`/api/bff/lifeguard/home`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`POST /api/bff/lifeguard/cleanup`、`POST /api/bff/lifeguard/photo-upload`。
- Section key / planned endpoint：plannedEndpoint=`/api/bff/lifeguard/home`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `lifeguard_cleanup_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 OBJECT_STORAGE 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /lifeguard/cleanup | lifeguard | lifeguard | partial |
| /lifeguard/closing-cleanup-photo | lifeguard | lifeguard | legacy |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| POST | /api/bff/lifeguard/cleanup | bff | partial |
| POST | /api/bff/lifeguard/photo-upload | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| plannedEndpoint | /api/bff/lifeguard/home |

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
| lifeguard_cleanup_logs | closing cleanup GPS photo records | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| OBJECT_STORAGE | Cleanup photo upload storage. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: lifeguard, supervisor, system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Use work-log task categories; no standalone schema in this pass.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
