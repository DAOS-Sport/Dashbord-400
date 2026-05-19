---
module_id: weather-widget
label: "天氣卡片"
status: implemented
domain: integration
owner_role: system
source_of_truth: external
generated_at: 2026-05-18
---

# 天氣卡片

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：system；可見角色 employee
2. RAGIC / 資料庫：不使用 Ragic；資料源為 external
3. 功能 / 需求 / 用途：Employee home weather widget powered by CWA (中央氣象局) open data API, station 466920 (板橋). 10-minute in-memory cache. 狀態：implemented / 已接線。

## Registry Snapshot

- Module ID: `weather-widget`
- Status: implemented / 已接線
- Domain: `integration`
- Source of truth: `external`
- Homepage widget: yes
- Visibility: homepage_widget
- Priority: {"employee":60}



## 功能邏輯

- 沒有獨立前端入口；由 BFF、背景工作或其他模組引用。
- 讀取透過 `GET https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001`。
- 目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。
- 外部或基礎依賴：CWA。
- 沒有登記資料表或 entity。

## 資料寫法 / 寫入規則

- 資料權威：`external`。
- 沒有 Postgres 寫入權威登記。
- 沒有 projection 資料登記。
- 沒有 telemetry 資料登記。
- 沒有 external data binding。
- 沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。

## UI/UX 邏輯

- Surface model：home-card / dashboard widget；UI density：mobile-first、touch target 優先、資訊分段顯示。
- 首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。
- 尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。
- 尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。
- 畫面資料應優先吃 BFF section / endpoint：`weather`。
- 目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。
- UI telemetry：card click。

## BFF 參照 / 修改關聯

- 沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。
- Section key / planned endpoint：employeeSectionKey=`weather`。
- 沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。
- Proxy / external 邊界：`GET https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001`；前端不得繞過此邊界。
- 修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。

## 修改檢查清單

- UI：確認 home-card / dashboard widget 的 loading / empty / degraded / error / disabled 狀態。
- BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。
- 資料：目前沒有登記 data binding；新增資料前先補 registry。
- 整合：確認 CWA 的 fallback / unavailable 狀態有對應 UI。
- 文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。

## Routes

_沒有 route 綁定_

## API / BFF

| Method | Path | Kind | Status |
| --- | --- | --- | --- |
| GET | https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001 | proxy | implemented |

### BFF Sections

| Binding | Value |
| --- | --- |
| employeeSectionKey | weather |

### UI State Contract

| Field | Value |
| --- | --- |
| uiStates | 未登記 |
| freshness | 未登記 |
| uiStateSourceFiles | 未登記 |
| sharedComponents | 未登記 |

## Data

_沒有資料表或資料源綁定_

## Integrations

| Provider | Purpose | Status | Notes |
| --- | --- | --- | --- |
| CWA | Real-time temperature, humidity and weather condition from 板橋 station (466920). Requires CWA_API_KEY env var. | implemented |  |

## Telemetry / Governance

- Telemetry: pageView=no；cardClick=yes；actionSubmit=no；auditRequired=no
- Event types: 未登記
- Editable by: system
- Readonly for: employee
- Requires approval: no
- Governance notes: CWA_API_KEY must be set. Gracefully degrades to unavailable when key is missing or API times out.

## Legacy

- Old names: 無
- Old routes: 無
- Migration notes: 無
