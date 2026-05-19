---
module_id: helper-status
label: "400LINE 服務監控"
status: implemented
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: private
generated_at: 2026-05-18
---

# 400LINE 服務監控

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：RAGIC：Employee and caution-list lookups.
3. 功能 / 需求 / 用途：Legacy detailed service-status view for 400LINE external services, exposed endpoints, required secrets, and resilience rules. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `helper-status`
- Status: implemented / 已接線
- Domain: `system`
- Source of truth: `private`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, system_only
- Priority: {"system":7}

## Implementation Owners

- UI owner：`client/src/modules/system/helper-status/page.tsx`。
- BFF route owner：`server/modules/system/helper-status-routes.ts`；不得再把 400 小幫手狀態端點加回 `server/modules/system/routes.ts`。
- Catalog / DTO owner：`shared/system/helper-status.ts`；只可輸出 configured / missing 狀態，不得輸出 secret value。
- Authenticated BFF smoke：`scripts/authenticated-bff-smoke.ts` 必須覆蓋 anonymous 401、non-system 403、system 200。
- Registry owner：`shared/modules/registry/foundation.ts`。


## 功能邏輯

- 入口從 `/system/lineXBS-status`、`/system/helper-status` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/helper-status`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：LINE_BOT_ASSISTANT、UNKNOWN、RAGIC。
- 資料落點 / entity：`external service catalog`。

## 資料寫法 / 寫入規則

- 資料權威：`private`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- Registry uiStates：`loading`、`ready`、`empty`、`error`、`degraded`；freshness=`5min`。
- 跨 section 視覺最小單元：`DenseRow`、`FreshnessIndicator`。
- 畫面資料應優先吃 BFF section / endpoint：`helperStatus`、`/api/bff/system/helper-status`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/helper-status`。
- Section key / planned endpoint：systemSectionKey=`helperStatus`、plannedEndpoint=`/api/bff/system/helper-status`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `external service catalog` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT、UNKNOWN、RAGIC 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/lineXBS-status | system | system | implemented |
| /system/helper-status | system | system | legacy |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/helper-status | bff | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | helperStatus |
| plannedEndpoint | /api/bff/system/helper-status |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | loading, ready, empty, error, degraded |
| freshness | 5min |
| uiStateSourceFiles | `client/src/modules/system/helper-status/page.tsx` |
| sharedComponents | `DenseRow`, `FreshnessIndicator` |

## Data

| Table / Entity | Entity | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| external service catalog | external service catalog | private | implemented | Seeded from the external service list markdown and redacts secret values. |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | LINE Messaging API and webhook status source. | external |  |
| UNKNOWN | OpenAI API for AI helper features. | external |  |
| UNKNOWN | Google Gemini API for announcement classifier Pass 2. | external |  |
| RAGIC | Employee and caution-list lookups. | external |  |
| UNKNOWN | CWA weather and UV data. | external |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=no
- Event types: HELPER_STATUS_VIEW
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: Belongs to the 400LINE domain under /system/linebot-management. Values show configured/missing state only; never expose secret contents.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
