---
module_id: system-governance
label: "治理面"
status: implemented
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: telemetry
generated_at: 2026-05-18
---

# 治理面

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：不使用 Ragic；資料源為 telemetry
3. 功能 / 需求 / 用途：Governance hub for module registry, function relations, topology notes, and audit raw views. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `system-governance`
- Status: implemented / 已接線
- Domain: `system`
- Source of truth: `telemetry`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, system_only
- Priority: {"system":5}



## 功能邏輯

- 入口從 `/system/governance` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/modules/registry`、`GET /api/system/module-registry`、`GET /api/audit/logs`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：POSTGRES。
- 資料落點 / entity：`module_settings`、`audit_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`telemetry`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`module_settings`。
- 沒有 projection 資料登記。
- Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：`audit_logs`。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`governance`、`/api/modules/registry`、`/api/audit/logs`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/modules/registry`、`GET /api/system/module-registry`。
- Section key / planned endpoint：systemSectionKey=`governance`、plannedEndpoint=`/api/modules/registry`、plannedEndpoint=`/api/audit/logs`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `module_settings`、`audit_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/governance | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/modules/registry | bff | implemented |
| GET | /api/system/module-registry | bff | implemented |
| GET | /api/audit/logs | telemetry | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | governance |
| plannedEndpoint | /api/modules/registry |
| plannedEndpoint | /api/audit/logs |

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
| module_settings | module governance settings | postgres | partial |  |
| audit_logs | audit raw records | telemetry | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| POSTGRES | Registry settings and audit governance. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: ARCHITECTURE_RELATION_VIEW, TOPOLOGY_VIEW, AUDIT_LOG_VIEW
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Replaces old function-relations, topology, audit, and auxiliary observer nav entries.

## Legacy

- Old names: 無
- Old routes: /system/function-relations, /system/topology, /system/audit, /system/training-views
- Migration notes: These former observer pages are now tabs inside /system/governance.
