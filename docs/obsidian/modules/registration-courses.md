---
module_id: registration-courses
label: "報名 / 課程"
status: partial
domain: support
owner_role: system
source_of_truth: external
generated_at: 2026-05-18
---

# 報名 / 課程

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 employee
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Registration and course entry placeholder; booking provider is not connected yet. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `registration-courses`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `external`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page
- Priority: {"employee":23}



## 功能邏輯

- 入口從 `/employee/registration-courses` 進入，依角色 employee 顯示。
- 讀取透過 `GET /api/bff/system/module-health/registration-courses`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：UNKNOWN。
- 資料落點 / entity：`registration_courses`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`registration_courses`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`registrationCourses`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view、card click。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/module-health/registration-courses`。
- Section key / planned endpoint：employeeSectionKey=`registrationCourses`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `registration_courses` 的讀寫方向沒有繞過 owner module。
- 整合：確認 UNKNOWN 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /employee/registration-courses | employee | employee | partial |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/module-health/registration-courses | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | registrationCourses |

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
| registration_courses | registration course stub | postgres | partial |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| UNKNOWN | Future course registration provider. | planned |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: system
- Readonly for: employee
- Requires approval: no
- Governance notes: Not connected; renders not-connected surface through EmployeeMorePage.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
