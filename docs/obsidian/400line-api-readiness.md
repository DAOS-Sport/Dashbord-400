# 400LINE API Readiness

[[00-index|模組總覽]] / [[400line-management-blueprint|400LINE 管理藍圖]] / [[modules/linebot-management|linebot-management]]

這頁定義 400QIAN 對 400LINE API 的讀取狀態。前端不得直接呼叫 400LINE；一律經過 `/api/bff/system/linebot-management/*` 正規化。

## Status Contract

| Status | Meaning | UI Behavior |
| --- | --- | --- |
| `ready` | 回 JSON 且可被 BFF 正規化。 | 顯示資料與最後同步時間。 |
| `degraded` | API 可到但資料缺角、HTTP 非 2xx 或 fallback 使用中。 | 顯示降級原因，不阻塞其他 tabs。 |
| `waiting_for_400line_api` | 端點已規劃但目前回 HTML、缺 JSON、缺 token 或尚未修復。 | 顯示等待修復，不爆頁。 |
| `error` | 連線失敗或 BFF 無法解析。 | 顯示錯誤 state，保留其他可用區塊。 |

## Current Endpoint Map

| Endpoint | Owner | Current Use | Expected Status |
| --- | --- | --- | --- |
| `GET /api/admin/announcements/health` | 400LINE | 重要公告管線健康。 | `ready` if JSON |
| `GET /api/facility-home/list` | 400LINE | 群組 / 館別清單。 | `ready` if JSON |
| `GET /api/internal/facility-home/:groupId/home` | 400LINE | 單一館別首頁狀態。 | `waiting_for_400line_api` until stable sampling is wired |
| `GET /api/admin/interview-users` | 400LINE | 面試 / 慎用授權主控名單。 | `ready` if JSON |
| `GET /api/internal/service-health` | 400LINE | 服務健康總覽。 | `waiting_for_400line_api` until JSON/token contract is stable |
| `GET /api/internal/service-health/snapshots` | 400LINE | 服務健康歷史快照。 | `waiting_for_400line_api` until JSON/token contract is stable |
| `GET /api/admin/service-status` | 400LINE | Admin 服務監控。 | `waiting_for_400line_api` if current endpoint still returns HTML |
| `GET /api/admin/whitelist` | 400LINE | 公告 VIP 白名單。 | `waiting_for_400line_api` until final API shape is confirmed |
| `GET /api/internal/announcement-whitelist` | 400LINE | Internal 公告 VIP 白名單。 | `waiting_for_400line_api` until final API shape is confirmed |

## Rules

- BFF must redact secrets and reduce credential state to readiness only.
- Read-only shell endpoints can call 400LINE GET endpoints; write actions stay in dedicated whitelist flows.
- Broken 400LINE endpoints must return `waiting_for_400line_api`, not throw a page-level crash.
- New 400LINE endpoint intake must answer role, Ragic/data source, and purpose before registration.
