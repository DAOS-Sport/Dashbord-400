---
module_id: announcement-review
label: "Announcement Review"
status: partial
domain: support
owner_role: supervisor
source_of_truth: external
generated_at: 2026-05-18
---

# Announcement Review

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：supervisor；可見角色 supervisor, system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Supervisor review queue for LINE Bot announcement candidates. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `announcement-review`
- Status: partial / 部分接線
- Domain: `support`
- Source of truth: `external`
- Homepage widget: no
- Visibility: detail_page, admin_page, portal_page
- Priority: {}



## 功能邏輯

- 入口從 `/announcements`、`/portal/:facilityKey/review`、`/supervisor/announcements` 進入，依角色 supervisor、system 顯示。
- 讀取透過 `GET /api/announcement-candidates`、`GET /api/announcement-candidates/:id`。
- 寫入透過 `POST /api/announcement-candidates/:id/approve`、`POST /api/announcement-candidates/:id/reject`。
- 外部或基礎依賴：LINE_BOT_ASSISTANT。
- 資料落點 / entity：`audit_logs`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`audit_logs`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/announcement-candidates/:id/approve`、`POST /api/announcement-candidates/:id/reject`。

## UI/UX 邏輯

- Surface model：admin management surface；UI density：營運掃描密度、表格/列表可比較、批次操作需明確狀態。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`announcementReview`、`/api/announcement-candidates`。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：page view、action submit、audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：supervisorSectionKey=`announcementReview`、plannedEndpoint=`/api/announcement-candidates`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET /api/announcement-candidates`、`GET /api/announcement-candidates/:id`、`POST /api/announcement-candidates/:id/approve`、`POST /api/announcement-candidates/:id/reject`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 admin management surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `audit_logs` 的讀寫方向沒有繞過 owner module。
- 整合：確認 LINE_BOT_ASSISTANT 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

| Path | Role | Kind | Status |
| --- | --- | --- | --- |
| /announcements | system | legacy_admin | implemented |
| /portal/:facilityKey/review | employee | legacy_portal | partial |
| /supervisor/announcements | supervisor | supervisor | implemented |

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | /api/announcement-candidates | proxy | legacy |
| GET | /api/announcement-candidates/:id | proxy | legacy |
| POST | /api/announcement-candidates/:id/approve | proxy | legacy |
| POST | /api/announcement-candidates/:id/reject | proxy | legacy |

### BFF Sections

| Binding | Value |
| --- | --- |
| supervisorSectionKey | announcementReview |
| plannedEndpoint | /api/announcement-candidates |

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
| audit_logs | review audit trail | postgres | planned | Server-side audit write path is still planned. |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| LINE_BOT_ASSISTANT | Candidate approval/rejection upstream. | external |  |

## Telemetry / Governance

- Telemetry: pageView=yes；cardClick=no；actionSubmit=yes；auditRequired=yes
- Event types: announcement_approve, announcement_reject
- Editable by: supervisor, system
- Readonly for: 未登記
- Requires approval: yes
- Governance notes: Review actions must eventually write audit logs.

## Legacy

- Old names: 無
- Old routes: /announcements, /portal/:facilityKey/review
- Migration notes: 無
