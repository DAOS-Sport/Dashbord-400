---
module_id: linebot-integration
label: "LINE Bot Assistant Integration"
status: external
domain: integration
owner_role: system
source_of_truth: external
generated_at: 2026-05-18
---

# LINE Bot Assistant Integration

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 system, supervisor
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Proxy and fallback integration for announcement candidates, facility home, and LINE group payloads. 狀態：external / 外部。

## Registry Snapshot

- Module ID: `linebot-integration`
- Status: external / 外部
- Domain: `integration`
- Source of truth: `external`
- Homepage widget: no
- Visibility: background_only, system_only
- Priority: {}

## Implementation Owners

- System LINE Bot BFF route owner：`server/modules/system/line-bot-routes.ts`。
- Legacy announcement/facility LINE proxy owners remain in their existing route modules until the adapter migration is completed.
- Registry owner：`shared/modules/registry/portal-integrations.ts`。


## 功能邏輯

- 沒有獨立前端入口；由 BFF、背景工作或其他模組引用。
- 讀取透過 `GET /api/announcement-dashboard/summary`、`GET /api/announcement-candidates`、`GET /api/announcement-candidates/:id`、`GET /api/announcement-reports/weekly`、`GET /api/facility-home/:groupId/home`、`GET /api/facility-home/:groupId/announcements`、`GET /api/facility-home/:groupId/announcements/:id`、`GET /api/facility-home/:groupId/today-shift`、`GET /api/facility-home/:groupId/handover`、`GET /api/bff/system/line-bot/service-status`、`GET /api/bff/system/line-bot/service-status/snapshots`、`GET /api/bff/system/line-bot/interview-users`、`GET /api/bff/system/line-bot/vip-whitelist`、`GET /api/internal/service-health`、`GET /api/internal/service-health/snapshots`。
- 寫入透過 `POST /api/announcement-candidates/:id/approve`、`POST /api/announcement-candidates/:id/reject`、`POST /api/facility-home/:groupId/announcements/:id/ack`、`POST /api/bff/system/line-bot/interview-users`、`PATCH /api/bff/system/line-bot/interview-users/:userId`、`DELETE /api/bff/system/line-bot/interview-users/:userId`、`POST /api/bff/system/line-bot/vip-whitelist`、`PATCH /api/bff/system/line-bot/vip-whitelist/:id`、`DELETE /api/bff/system/line-bot/vip-whitelist/:id`。
- 外部或基礎依賴：LINE_BOT_ASSISTANT。
- 資料落點 / entity：`source_snapshots`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- External 資料需經 adapter/proxy 正規化後進 BFF，不把外部 payload 直接暴露成 UI contract。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/announcement-candidates/:id/approve`、`POST /api/announcement-candidates/:id/reject`、`POST /api/facility-home/:groupId/announcements/:id/ack`、`POST /api/bff/system/line-bot/interview-users`、`PATCH /api/bff/system/line-bot/interview-users/:userId`、`DELETE /api/bff/system/line-bot/interview-users/:userId`、`POST /api/bff/system/line-bot/vip-whitelist`、`PATCH /api/bff/system/line-bot/vip-whitelist/:id`、`DELETE /api/bff/system/line-bot/vip-whitelist/:id`。

## UI/UX 邏輯

- Surface model：system governance surface；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`/api/bff/employee/home`、`/api/bff/system/line-bot/service-status`、`/api/bff/system/line-bot/service-status/snapshots`、`/api/internal/service-health`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：audit required。

## BFF 參照 / 修改關聯

- BFF endpoint owner：`GET /api/bff/system/line-bot/service-status`、`GET /api/bff/system/line-bot/service-status/snapshots`、`GET /api/internal/service-health`、`GET /api/internal/service-health/snapshots`。
- Section key / planned endpoint：plannedEndpoint=`/api/bff/employee/home`、plannedEndpoint=`/api/bff/system/line-bot/service-status`、plannedEndpoint=`/api/bff/system/line-bot/service-status/snapshots`、plannedEndpoint=`/api/internal/service-health`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/announcement-dashboard/summary`、`GET /api/announcement-candidates`、`GET /api/announcement-candidates/:id`、`POST /api/announcement-candidates/:id/approve`、`POST /api/announcement-candidates/:id/reject`、`GET /api/announcement-reports/weekly`、`GET /api/facility-home/:groupId/home`、`GET /api/facility-home/:groupId/announcements`、`GET /api/facility-home/:groupId/announcements/:id`、`GET /api/facility-home/:groupId/today-shift`、`GET /api/facility-home/:groupId/handover`、`POST /api/facility-home/:groupId/announcements/:id/ack`、`GET /api/bff/system/line-bot/interview-users`、`POST /api/bff/system/line-bot/interview-users`、`PATCH /api/bff/system/line-bot/interview-users/:userId`、`DELETE /api/bff/system/line-bot/interview-users/:userId`、`GET /api/bff/system/line-bot/vip-whitelist`、`POST /api/bff/system/line-bot/vip-whitelist`、`PATCH /api/bff/system/line-bot/vip-whitelist/:id`、`DELETE /api/bff/system/line-bot/vip-whitelist/:id`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 system governance surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `source_snapshots` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

_沒有 route 綁定_

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/announcement-dashboard/summary | proxy | legacy |
| GET | /api/announcement-candidates | proxy | legacy |
| GET | /api/announcement-candidates/:id | proxy | legacy |
| POST | /api/announcement-candidates/:id/approve | proxy | legacy |
| POST | /api/announcement-candidates/:id/reject | proxy | legacy |
| GET | /api/announcement-reports/weekly | proxy | legacy |
| GET | /api/facility-home/:groupId/home | proxy | legacy |
| GET | /api/facility-home/:groupId/announcements | proxy | legacy |
| GET | /api/facility-home/:groupId/announcements/:id | proxy | legacy |
| GET | /api/facility-home/:groupId/today-shift | proxy | legacy |
| GET | /api/facility-home/:groupId/handover | proxy | legacy |
| POST | /api/facility-home/:groupId/announcements/:id/ack | proxy | legacy |
| GET | /api/bff/system/line-bot/service-status | bff | implemented |
| GET | /api/bff/system/line-bot/service-status/snapshots | bff | implemented |
| GET | /api/bff/system/line-bot/interview-users | proxy | implemented |
| POST | /api/bff/system/line-bot/interview-users | proxy | implemented |
| PATCH | /api/bff/system/line-bot/interview-users/:userId | proxy | implemented |
| DELETE | /api/bff/system/line-bot/interview-users/:userId | proxy | implemented |
| GET | /api/bff/system/line-bot/vip-whitelist | proxy | implemented |
| POST | /api/bff/system/line-bot/vip-whitelist | proxy | implemented |
| PATCH | /api/bff/system/line-bot/vip-whitelist/:id | proxy | implemented |
| DELETE | /api/bff/system/line-bot/vip-whitelist/:id | proxy | implemented |
| GET | /api/internal/service-health | bff | partial |
| GET | /api/internal/service-health/snapshots | bff | partial |

### BFF Sections

| Binding | Value |
| --- | --- |
| plannedEndpoint | /api/bff/employee/home |
| plannedEndpoint | /api/bff/system/line-bot/service-status |
| plannedEndpoint | /api/bff/system/line-bot/service-status/snapshots |
| plannedEndpoint | /api/internal/service-health |

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
| source_snapshots | LINE source snapshot | external | planned |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | External LINE Bot Assistant upstream. | external |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: 未登記
- Editable by: system
- Readonly for: supervisor
- Requires approval: no
- Governance notes: External integration; route proxy remains legacy until adapter extraction is complete.

## Legacy

- Old names: 無
- Old routes: /api/announcement-candidates, /api/facility-home/:groupId/*
- Migration notes: 無
