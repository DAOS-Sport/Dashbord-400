# 400LINE Management Blueprint

[[00-index|模組總覽]] / [[400line-api-readiness|400LINE API Readiness]] / [[modules/linebot-management|linebot-management]]

## Domain Split

| Domain | Scope | Source of Truth | Purpose |
| --- | --- | --- | --- |
| 400CMS | 400QIAN CMS, BFF, module registry, audit, telemetry, local UI health. | 400QIAN repo / CMS DB / module registry / telemetry. | 監控 CMS 本體是否健康、模組是否完整、IT 操作是否有紀錄。 |
| 400LINE | 400LINE / LINE Bot Assistant / LINE 官方帳號 / Ragic 授權資料 / 公告管線。 | 400LINE API / LINE Bot DB / Ragic H01/H02 / 400QIAN shadow snapshot. | 監控 LINE Bot 服務、白名單、群組/館別與重要公告資料流。 |

## Navigation

- 400CMS：控制中心、Watchdog、運維協助、行為洞察、治理面。
- 400LINE：400LINE 管理、服務監控、白名單。
- `/system/lineXBS-status` and `/system/line-whitelist` remain compatible routes and can become tab deep-links later.

## 400LINE Management Tabs

| Tab | Purpose | BFF |
| --- | --- | --- |
| 總覽 | 整體狀態、可用 API、等待修復 API、最後同步時間。 | `GET /api/bff/system/linebot-management/overview` |
| 服務監控 | LINE Messaging API、公告管線、Gemini/OpenAI、Ragic、CWA、Webhook、DB。 | `GET /api/bff/system/linebot-management/services` |
| 群組 / 館別 | `/api/facility-home/list` 與 groupId 狀態。 | `GET /api/bff/system/linebot-management/facilities` |
| 白名單 / 權限 | 面試、慎用、人員查詢、VIP 公告授權 snapshot 與 diff。 | `GET /api/bff/system/linebot-management/whitelist-snapshot` |
| 重要公告管線 | 5 層篩選機制、候選數、今日處理量、員工端進入規則。 | `GET /api/bff/system/linebot-management/announcement-pipeline` |
| API Readiness | 可用、回 HTML、等待 400LINE 修復的端點清單。 | Aggregated from all management BFF endpoints |

## Whitelist Rules

- 400LINE is the authority.
- 400QIAN keeps shadow/snapshot for diff: only in 400LINE, only in 400QIAN shadow, and status mismatch.
- Ragic lookup order: H01 first, H02 fallback.
- Existing authorized users are never deleted in CMS product behavior; disable or expiry revokes access.

## Announcement Entry Rule

Employee important group announcements may include high-confidence candidates when:

- `priority = must_read | high`
- `confidence >= 0.85`
- facility/group scope matches
- local displayable filter passes

Employee UI must label source as 已發布, 高信心候選, or 等待審核.
