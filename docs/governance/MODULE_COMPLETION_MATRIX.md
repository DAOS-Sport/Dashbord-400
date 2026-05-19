# Module Completion Matrix

Date: 2026-05-19

This matrix is role-first. Each row separates user-facing function status from backend logic status so the project does not confuse UI presence with production readiness.

Lifecycle closure is tracked in `docs/governance/MODULE_CLOSURE_MATRIX.md`. Retired modules are not active completion targets.

## Employee

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| employee-home | 員工首頁 | 80% | 完成：首頁載入、核心卡片 DTO、navigation DTO | 完成：BFF fallback 不因單一資料源 500 | 舊 UI section 與新 HomeCardDto 並存 | 下一輪收斂前端只讀 HomeCardDto |
| handover | 交辦事項 | 95% | 完成：員工首頁卡、drawer、新增、pending 依剩餘時間排序、已完成查詢、標記已讀、回覆補充、刪除、標記完成 | 完成：`server/modules/handover`、`/api/handover`、`/api/bff/employee/handover/*`、同館權限；救生端以 lifeguard role 寫入同一 `operational_handovers` | 主管 legacy portal API 仍保留 | 下一輪補 handover API 情境測試與 supervisor namespace 收斂 |
| announcements | 群組重要公告 | 80% | 完成：搜尋、閱讀、已讀確認 | 部分完成：ack table/API/BFF 已接，發布審核仍分散 | LINE candidate 與 local announcement 尚未統一 policy；final closure batch 因 `server/modules/bff/routes.ts` 鎖定而 halt | 解鎖 BFF route 後補 announcement BFF policy |
| quick-links | 快速操作 | 80% | 完成：首頁 shortcuts、更多入口、主管維護 | 完成：Postgres `quick_links` | 缺完整 telemetry event | 補 NAV/CARD event dashboard |
| shift-reminder | 今日班表 / 班表入口 | 75% | 完成：員工首頁與班表頁改為時間排序、目前班別 highlight；degraded 狀態統一用 DegradedCard 呈現 | 部分完成：`/api/bff/employee/shifts/today` 從 Smart Schedule adapter 唯讀產生 ShiftBoard DTO | 外部資料未連線時為 degraded，不顯示假資料 | 保持外部唯讀，補 source snapshot 與部署端 adapter 驗證 |
| weather-widget | 天氣卡片 | 30% | 完成：not_connected 統一用 NotConnectedCard 呈現 | 未完成：無 weather provider | 未接線 | 接正式 weather adapter 前不得假資料 |
| search | 快速搜尋 | 70% | 部分完成：搜尋模組名稱/關鍵字與員工 Q&A | 部分完成：`/api/search/global` registry-backed stub；`/api/bff/employee/search` 已接 Q&A table | 尚未完整全文搜尋所有模組 | 下一輪擴到 announcements/handover/shifts full-text |
| knowledge-base-qna | 相關問題詢問 | 95% | 完成：員工 Q&A 資料庫頁、新增後 pending、review status badge、圖片/影片附件上傳與預覽、主管 `/supervisor/qna-review` approve/reject 與附件檢視 | 完成：`knowledge_base_qna.attachments`、CRUD API、`/api/portal/knowledge-base-qna/media`、supervisor review BFF、`QNA_APPROVED` / `QNA_REJECTED` audit、員工首頁搜尋只讀 approved | Replit migration `0015` 與 Object Storage 實傳仍需部署驗證 | 部署套用 migration 後跑三角色 Q&A attachment journey |
| activity-periods | 活動檔期 | 70% | 完成：正式 `/employee/activity-periods` 深藍卡片頁、分類 filter、empty state | 部分完成：沿用 employee home campaigns BFF，尚未有專屬 BFF policy | 來源混合 | 收斂到 campaigns-events DTO |
| registration-courses | 報名 / 課程 | 40% | 完成：員工首頁卡片入口已註冊，route 顯示統一 NotConnectedCard；主管端角色合約已移除避免無頁面入口 | 未完成：booking provider 未接 | 無正式課程資料，不能假造課程 | 接 booking adapter |

## Supervisor

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| supervisor-dashboard | 主管儀表板 | 96% | 完成：主管首頁、BFF 摘要、全視窗自適應 shell、收斂後主管導覽、場館 overview 卡片、現在當班人員抽屜 | 完成：授權場館 overview + staffing/handover/work-log fallback；當班抽屜以 `staffing.currentOnDuty` 依館別/職位/人員分層 | 單館 detail 完整員工視角留 post-launch | 上線後補 facility detail |
| handover | 交辦事項 | 95% | 完成：主管交辦頁與 API；建立交辦不再要求固定班別 | 完成：operational handover table，後端自動補 targetDate/targetShiftLabel 舊 schema 欄位 | 舊 API 仍在 portal namespace | 上線後搬入 module route |
| announcements | 公告管理 | 95% | 完成：手動發布、類型、置頂、啟用/停用、發布/下架時間、候選審核 | 完成：system_announcements + audit；員工 BFF 讀取 pinned/type/time | 需部署套用 `0006` | Replit 驗證 system_announcements CRUD |
| facilities | 場館狀態 | 95% | 完成：現場人力摘要、館別分布、授權場館簡表、當班/下一班、單館 detail route、櫃台交辦事項與救生模組/附件概況 | 部分完成：Ragic/session snapshot + `/api/bff/supervisor/facilities/:facilityKey/detail`；HR truth 外部 | 詳細人力仍需部署端 role snapshot 驗證 | post-launch 補 role snapshot sync 與完整員工視角 |
| quick-links | 快速入口 / 常用連結 | 85% | 完成：員工常用文件與既有 portal 管理；主管設定頁已移除 | 完成：CRUD API | 主管端專用管理入口暫停 | 需要時改由現有常用文件/Portal manage 管理，不重啟 `/supervisor/settings` |

## System

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| system-dashboard | 系統儀表板 | 70% | 完成：system overview alias | 部分完成：mock/real source fallback | `/api/bff/system/dashboard` 為 alias | 下一輪定正式 DTO |
| system-health | 系統健康 | 80% | 完成：health/integration overview | 完成：adapter config health | observability still lightweight | 接 module health DB audit |
| system-observability | 系統觀測 | 65% | 部分完成：module health API、adapter health overview | 部分完成：non-mock profile 走 DB-backed telemetry repository | 尚未完整串 integration_error_logs / sync_job_runs | Replit 驗證 DB 寫入後補 sync observability |
| telemetry-audit | 操作稽核 | 78% | 完成：ui-events/client-error/module-events、domain writes audit caller、大量 system audit visibility | 部分完成：DB-backed `ui_events` / `client_errors` / `audit_logs` repository 已存在，system-only `/api/audit/logs` 可查最新 audit rows | OpenTelemetry SDK 與 trace/metric/log taxonomy 未正式接；Replit DB row 尚需實測 | Replit 驗證 audit rows，下一輪補 trace/metric/log correlation |
| raw-inspector | Raw Inspector | 80% | 完成：system-only route、後端白名單 proxy、查詢 audit log、client 不再直打任意目標 | 完成：health 驗證 supervisor 不可見；server-side query scope 已收斂到 shared whitelist | 正式 raw data policy 與 Replit audit row 仍需部署驗收 | Replit 驗證 RAW_INSPECTOR_QUERY audit row 與 forbidden target |
| integrations | 整合監控 | 60% | 部分完成：integration overview | 部分完成：adapter health | sync job runner 未接 | 接 sync_job_runs writer |
| module-registry | 模組註冊中心 | 90% | 完成：registry/navigation/home-layout/health API；debug registry endpoints 已加 system role + system governance permission；三角色首頁/導航順序已由 smoke/unit 固定 | 完成：descriptor/policy/smoke；目前 78 modules / 78 descriptors | `widget-layout-settings` 為已接受 background/deprecated no-BFF 項目 | Replit 驗證 debug registry guard 與 no-BFF policy |

## SYSTEM_ADMIN

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| auth | 權限與 Session | 60% | 部分完成：cookie session、role/facility switch | 部分完成：localStorage 已不作權限真相 | session index hardening 未完成 | 接 DB session/audit |
| hr-audit | HR 權限稽核 | 40% | 部分完成：頁面與 registry | 未完成：正式稽核流程 | Ragic truth 外部 | 建 sync + audit writer |
| module-settings | 模組設定 | paused | 已暫停：不列入近期施工與上線範圍 | 未完成：DB persistence 不再作為當前目標 | 產品需求未收斂，避免做出半套設定器 | 未來若重啟，需先重寫 UX 規格與權限 ADR |

## Retired / Removed From Active Surface

| moduleId | lifecycle | reason | closure requirement |
| --- | --- | --- | --- |
| tasks | retired / deploy-pending | Dedicated task route/table has been removed from the current workbench surface; operational work is handled by handover and work-log flows. | Replit/Neon must apply `0014_retire_tasks_personal_note.sql` and confirm the `tasks` table is gone. |
| checkins | retired | Employee attendance/check-in page, navigation, default document link, module id, and backend registration were removed from the active workbench. | No production data table is dropped in this batch. |
| counter-log | retired | Supervisor counter-log workbench routes and module registration were removed; front-desk work items now use handover. | Historical work-log tables/API are retained until a separate data-retirement decision. |
| supervisor-lifeguard-overview | retired | Lifeguard overview is folded into `/supervisor/facilities/:facilityKey`. | Keep facility detail as the only supervisor lifeguard rollup surface. |
| supervisor anomaly/report routes | retired | Supervisor anomalies moved to system alerts; reports summary remains on supervisor home/system insights. | No anomaly data table is dropped in this batch. |
| personal-note | retired / deploy-pending | Sticky notes were removed from the active employee workbench; employee resources remain for documents/events/training. | Replit/Neon must confirm `employee_resources.category='sticky_note'` rows are gone and no UI path recreates them. |

## Role Summary

| role | ready modules | unfinished modules | main blocker |
| --- | ---: | ---: | --- |
| employee | local-ready | deploy-pending providers | active workbench excludes retired `tasks` and `personal-note`; remaining rows are provider-backed or external validation |
| supervisor | local-ready | deploy-pending providers | active workbench excludes retired `tasks`; remaining rows are background/external or post-launch validation |
| system | local-ready | observability/integration proof | remaining rows are observability DB validation, integration sourceStatus, and background governance |
