# IT / System 端執行藍圖

版本：2026-04-30

## 1. 目的

IT / System 端不是另一套員工或主管 UI，而是整個 CMS 的營運控制台。它負責看見模組健康度、資料接線、權限邊界、audit / telemetry、外部整合與部署狀態。

核心原則：

- 所有資料仍走 BFF / server module，不讓前端直接拼外部 API。
- IT 可以看 raw health 與 audit，但不能繞過 session / role / facility 權限。
- IT 端只做治理與診斷，不把未完成的 module config 編輯假裝成 production ready。
- 所有高風險設定改動都必須寫 audit_logs。

## 2. 建議 Route

| Route | 頁面 | 目的 |
|---|---|---|
| `/system` | System Overview | 全系統健康總覽 |
| `/system/modules` | Module Registry | 模組註冊、狀態、BFF 接線、可見角色 |
| `/system/integrations` | Integrations | Ragic、Smart Schedule、LINE Bot、Gmail、Object Storage 狀態 |
| `/system/audit` | Audit Trail | audit_logs 查詢、actor / role / facility 篩選 |
| `/system/telemetry` | Telemetry | ui_events、client_errors、module health |
| `/system/raw-inspector` | Raw Inspector | 限 SYSTEM_ADMIN，用於 DB / DTO 檢查 |
| `/system/deploy-readiness` | Deploy Readiness | Replit 環境變數、migration、smoke gates |

## 3. BFF / API 契約

IT 端最少需要以下 endpoint：

| Endpoint | 權限 | 回傳 |
|---|---|---|
| `GET /api/bff/system/dashboard` | `system` | system overview DTO |
| `GET /api/modules/health` | `system` | module health |
| `GET /api/system/module-registry` | `SYSTEM_ADMIN` 或 `system` | raw registry |
| `GET /api/telemetry/module-events` | `system` | telemetry event list |
| `GET /api/telemetry/client-errors` | `system` | client error list |
| `GET /api/audit/logs` | `system` | audit logs |
| `GET /api/integrations/health` | `system` | external adapter status |

若 endpoint 尚未存在，Replit 端先以 `not_connected` DTO 回傳，不要在前端塞假資料。

## 4. 頁面設計方向

IT 端視覺沿用主管端工作台：

- 深藍 sidebar。
- 淡灰主背景。
- 白底管理卡片。
- KPI strip + health table。
- 清楚的 `ready / degraded / not_connected / error` 狀態。
- raw data 只在明確點開 inspector 時顯示。

不要做成行銷首頁或孤立 debug JSON 頁。

## 5. Module Health 欄位

每個 module 在 IT 端至少顯示：

| 欄位 | 說明 |
|---|---|
| `moduleId` | registry id |
| `stage` | planned / ui-only / api-wired / bff-wired / production-ready |
| `routeOk` | 前端 route 是否存在 |
| `bffOk` | BFF endpoint 是否存在 |
| `apiOk` | mutation API 是否存在 |
| `dbOk` | DB table / migration 是否可用 |
| `permissionOk` | role guard 是否存在 |
| `telemetryOk` | UI / audit event 是否接上 |
| `lastCheckedAt` | 檢查時間 |
| `issues` | 可行動問題 |

## 6. 外部整合監控

| Integration | 判定 |
|---|---|
| Ragic H05 | 可讀 OT 部門、可回候選館別 |
| Ragic Employee | 可驗證員工登入與角色 |
| Smart Schedule | 可讀今日班表，不允許本地寫排班 |
| LINE Bot Assistant | 可讀候選公告或明確 not_connected |
| Gmail SMTP | 可發異常通知或明確 not_connected |
| Postgres / Neon | schema columns 與 migrations 完整 |

## 7. Audit / Telemetry 規則

IT 端必須能回答：

- 誰在什麼角色、什麼場館做了什麼操作。
- 哪個 module 最近出錯。
- 哪些 client error 正在集中發生。
- 哪些資料來源是 `mock`、`not_connected`、`degraded`。

最低 audit action：

- `SYSTEM_ANNOUNCEMENT_CREATED`
- `SYSTEM_ANNOUNCEMENT_UPDATED`
- `TASK_CREATED`
- `TASK_UPDATED`
- `OPERATIONAL_HANDOVER_CREATED`
- `EMPLOYEE_RESOURCE_CREATED`
- `KNOWLEDGE_QNA_CREATED`
- `CLIENT_ERROR_REPORTED`

## 8. 本輪已確認的公告鏈路狀態

已完成：

- 主管公告 UI 寫入 `/api/portal/system-announcements`。
- 後端 create / update 已寫 audit。
- 員工 BFF fallback 會讀 `system_announcements`。
- 已修正：員工 BFF projection enrich 路徑也會合併 `system_announcements`，避免 projection 存在時漏掉主管發布公告。

仍需 Replit 驗收：

- localhost 本輪 POST `/api/portal/system-announcements` 回 `500 {"message":"建立失敗"}`。
- 本機 shell 沒有 `DATABASE_URL`，無法直接判斷 dev server 連到哪個 DB。
- Replit 部署前必須確認 `system_announcements` 已套用 `0006_supervisor_announcement_controls.sql`，且表內包含 `announcement_type`、`is_pinned`、`facility_keys`、`published_at`、`expires_at` 等欄位。

## 9. 不做事項

- 不在 IT 端重做員工 / 主管功能。
- 不讓 IT 端直接修改排班外部來源。
- 不讓 localStorage 成為 role / facility / session 真相。
- 不在 Phase 3 未完成前開放完整 module configs 拖拉編輯。
