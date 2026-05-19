---
module_id: gmail-integration
label: "Gmail SMTP Integration"
status: partial
domain: integration
owner_role: system
source_of_truth: external
generated_at: 2026-05-18
---

# Gmail SMTP Integration

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 system
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：SMTP delivery for anomaly notification and test email route. 狀態：partial / 部分接線。

## Registry Snapshot

- Module ID: `gmail-integration`
- Status: partial / 部分接線
- Domain: `integration`
- Source of truth: `external`
- Homepage widget: no
- Visibility: background_only, system_only
- Priority: {}



## 功能邏輯

- 沒有獨立前端入口；由 BFF、背景工作或其他模組引用。
- 沒有登記讀取 API；資料多半由其他 projection 或背景流程提供。
- 寫入透過 `POST /api/test-email`。
- 外部或基礎依賴：GMAIL_SMTP。
- 資料落點 / entity：`notification_recipients`。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：`notification_recipients`。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 寫入 API 需保留權限檢查、審計或狀態切換語意：`POST /api/test-email`。

## UI/UX 邏輯

- Surface model：system governance surface；UI density：IT governance density、狀態/錯誤可掃描、避免裝飾性版面。
- 非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 沒有 BFF binding 時，UI 不應直接新增外部 fetch；先補 BFF contract 或標成 legacy/background。
- 有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。
- UI telemetry：audit required。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- 沒有 section key；若要進首頁或 dashboard，需要先補 section key / planned endpoint。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- 沒有 proxy / external API 邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 system governance surface 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：確認 `notification_recipients` 的讀寫方向沒有繞過 owner module。
- 整合：確認 GMAIL_SMTP 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

_沒有 route 綁定_

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| POST | /api/test-email | legacy | partial |

### BFF Sections

_沒有 BFF section 綁定_

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
| notification_recipients | email recipient | postgres | implemented |  |

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| GMAIL_SMTP | Send anomaly notifications and verify SMTP configuration. | partial |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=no；actionSubmit=no；auditRequired=yes
- Event types: 未登記
- Editable by: system
- Readonly for: 未登記
- Requires approval: no
- Governance notes: Partial because SMTP depends on env credentials and has only a test route.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
