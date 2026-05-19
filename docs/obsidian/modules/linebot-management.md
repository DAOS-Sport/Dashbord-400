---
module_id: linebot-management
label: "400LINE 管理"
status: implemented
domain: system
owner_role: SYSTEM_ADMIN
source_of_truth: external
generated_at: 2026-05-18
---

# 400LINE 管理

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：SYSTEM_ADMIN；可見角色 system, SYSTEM_ADMIN
2. RAGIC / 資料庫：RAGIC：H01 employee source with H02 fallback for name, LINE userId, phone, and department matching.
3. 功能 / 需求 / 用途：System domain entry for monitoring 400LINE / LINE Bot Assistant service health, facility groups, whitelist snapshots, announcement pipeline, and API readiness. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `linebot-management`
- Status: implemented / 已接線
- Domain: `system`
- Source of truth: `external`
- Homepage widget: yes
- Visibility: homepage_widget, detail_page, system_only
- Priority: {"system":6}

## Implementation Owners

- UI owner：`client/src/modules/system/linebot-management/page.tsx`。
- BFF route owner：`server/modules/system/linebot-management-routes.ts`；此模組只做 read-only normalized DTO，不對 400LINE 執行寫入。
- DTO owner：`shared/system/linebot-management-contract.ts`；狀態固定為 `ready | degraded | waiting_for_400line_api | error`。
- Data authority：400LINE / LINE Bot Assistant；400QIAN 只保留 shadow/snapshot 與 diff。
- Registry owner：`shared/modules/registry/foundation.ts`、`shared/navigation/workbench-routes.ts`、`shared/modules/descriptors.ts`。


## 功能邏輯

- 入口從 `/system/linebot-management` 進入，依角色 system、SYSTEM_ADMIN 顯示。
- 讀取透過 `GET /api/bff/system/linebot-management/overview`、`GET /api/bff/system/linebot-management/services`、`GET /api/bff/system/linebot-management/facilities`、`GET /api/bff/system/linebot-management/whitelist-snapshot`、`GET /api/bff/system/linebot-management/announcement-pipeline`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：LINE_BOT_ASSISTANT、RAGIC、POSTGRES。
- 資料落點 / entity：`400LINE service health snapshot`、`line_feature_whitelist`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`line_feature_whitelist`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- External 資料需經 adapter/proxy 正規化後進 BFF，不把外部 payload 直接暴露成 UI contract。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- Registry uiStates：`loading`、`ready`、`empty`、`error`、`degraded`、`stale`；freshness=`5min`。
- 跨 section 視覺最小單元：`FreshnessIndicator`。
- 畫面資料應優先吃 BFF section / endpoint：`linebotManagement`、`/api/bff/system/linebot-management/overview`、`/api/bff/system/linebot-management/services`、`/api/bff/system/linebot-management/facilities`、`/api/bff/system/linebot-management/whitelist-snapshot`、`/api/bff/system/linebot-management/announcement-pipeline`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：page view。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/linebot-management/overview`、`GET /api/bff/system/linebot-management/services`、`GET /api/bff/system/linebot-management/facilities`、`GET /api/bff/system/linebot-management/whitelist-snapshot`、`GET /api/bff/system/linebot-management/announcement-pipeline`。
- Section key / planned endpoint：systemSectionKey=`linebotManagement`、plannedEndpoint=`/api/bff/system/linebot-management/overview`、plannedEndpoint=`/api/bff/system/linebot-management/services`、plannedEndpoint=`/api/bff/system/linebot-management/facilities`、plannedEndpoint=`/api/bff/system/linebot-management/whitelist-snapshot`、plannedEndpoint=`/api/bff/system/linebot-management/announcement-pipeline`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `400LINE service health snapshot`、`line_feature_whitelist` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT、RAGIC、POSTGRES 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /system/linebot-management | system | system | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/bff/system/linebot-management/overview | bff | implemented |
| GET | /api/bff/system/linebot-management/services | bff | implemented |
| GET | /api/bff/system/linebot-management/facilities | bff | implemented |
| GET | /api/bff/system/linebot-management/whitelist-snapshot | bff | implemented |
| GET | /api/bff/system/linebot-management/announcement-pipeline | bff | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| systemSectionKey | linebotManagement |
| plannedEndpoint | /api/bff/system/linebot-management/overview |
| plannedEndpoint | /api/bff/system/linebot-management/services |
| plannedEndpoint | /api/bff/system/linebot-management/facilities |
| plannedEndpoint | /api/bff/system/linebot-management/whitelist-snapshot |
| plannedEndpoint | /api/bff/system/linebot-management/announcement-pipeline |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | loading, ready, empty, error, degraded, stale |
| freshness | 5min |
| uiStateSourceFiles | `client/src/modules/system/linebot-management/page.tsx` |
| sharedComponents | `FreshnessIndicator` |

## Data

| Table / Entity | Entity | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| 400LINE service health snapshot | 400LINE service health snapshot | external | partial | Normalized from 400LINE JSON endpoints; waiting endpoints are surfaced without throwing UI errors. |
| line_feature_whitelist | 400QIAN whitelist shadow snapshot | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | Authority for LINE official account services, feature whitelist, facility groups, and announcement pipeline readiness. | external |  |
| RAGIC | H01 employee source with H02 fallback for name, LINE userId, phone, and department matching. | external |  |
| POSTGRES | 400QIAN shadow comparison for whitelist state. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=no；auditRequired=no
- Event types: LINEBOT_MANAGEMENT_VIEW, LINEBOT_API_READINESS_VIEW
- Editable by: SYSTEM_ADMIN
- Readonly for: system
- Requires approval: no
- Governance notes: 400LINE is the source of truth. This shell is read-only and must not expose secret values.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
