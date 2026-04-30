# Module Completion Matrix

Date: 2026-04-30

This matrix is role-first. Each row separates user-facing function status from backend logic status so the project does not confuse UI presence with production readiness.

## Employee

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| employee-home | 員工首頁 | 80% | 完成：首頁載入、核心卡片 DTO、navigation DTO | 完成：BFF fallback 不因單一資料源 500 | 舊 UI section 與新 HomeCardDto 並存 | 下一輪收斂前端只讀 HomeCardDto |
| tasks | 今日任務 / 交班事項 | 80% | 完成：員工新增、編輯自建、刪除自建、完成指派任務 | 完成：`/api/tasks`、同館權限、tasks table schema | 需在部署 DB 跑 migration | 執行 migration 後補 API 情境測試 |
| handover | 櫃台交接 / 櫃台交辦 | 95% | 完成：員工首頁卡、drawer、新增、pending 依剩餘時間排序、已完成查詢、標記已讀、回覆補充、刪除、標記完成 | 完成：`server/modules/handover`、`/api/handover`、`/api/bff/employee/handover/*`、同館權限 | 主管 legacy portal API 仍保留 | 下一輪補 handover API 情境測試與 supervisor namespace 收斂 |
| announcements | 群組重要公告 | 80% | 完成：搜尋、閱讀、已讀確認 | 部分完成：ack table/API/BFF 已接，發布審核仍分散 | LINE candidate 與 local announcement 尚未統一 policy | 建 announcement BFF policy |
| quick-links | 快速操作 | 80% | 完成：首頁 shortcuts、更多入口、主管維護 | 完成：Postgres `quick_links` | 缺完整 telemetry event | 補 NAV/CARD event dashboard |
| shift-reminder | 今日班表 / 班表入口 | 70% | 完成：員工首頁與班表頁改為時間排序、目前班別 highlight | 部分完成：`/api/bff/employee/shifts/today` 從 Smart Schedule adapter 唯讀產生 ShiftBoard DTO | 外部資料未連線時為 not_connected/degraded | 保持外部唯讀，補 source snapshot 與部署端 adapter 驗證 |
| weather-widget | 天氣卡片 | 20% | 未完成：只顯示 not_connected | 未完成：無 weather provider | 未接線 | 接正式 weather adapter 前不得假資料 |
| search | 快速搜尋 | 70% | 部分完成：搜尋模組名稱/關鍵字與員工 Q&A | 部分完成：`/api/search/global` registry-backed stub；`/api/bff/employee/search` 已接 Q&A table | 尚未完整全文搜尋所有模組 | 下一輪擴到 announcements/handover/shifts full-text |
| checkins | 點名 / 打卡 | 20% | 未完成：入口註冊 | 未完成：尚未有正式 DTO/API | 資料來源未定 | 先定 attendance BFF contract |
| knowledge-base-qna | 相關問題詢問 | 70% | 完成：員工 Q&A 資料庫頁、新增、補答、編輯、刪除、分類與標籤 | 部分完成：`knowledge_base_qna` table、CRUD API、audit、員工首頁搜尋接線 | 主管 curated review 尚未做 | 部署套用 migration 後補主管治理與 search smoke |
| personal-note | 個人記事 | 60% | 部分完成：employee_resources sticky note | 部分完成：CRUD 共用 employee resources | 不是獨立 personal-note table | 補 owner policy 與 UI 驗收 |
| activity-periods | 活動檔期 | 70% | 完成：正式 `/employee/activity-periods` 深藍卡片頁、分類 filter、empty state | 部分完成：沿用 employee home campaigns BFF，尚未有專屬 BFF policy | 來源混合 | 收斂到 campaigns-events DTO |
| registration-courses | 報名 / 課程 | 20% | 未完成：入口註冊 | 未完成：booking provider 未接 | 無正式課程資料 | 接 booking adapter |

## Supervisor

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| supervisor-dashboard | 主管儀表板 | 96% | 完成：主管首頁、BFF 摘要、全視窗自適應 shell、收斂後主管導覽、場館 overview 卡片、現在當班人員抽屜 | 完成：授權場館 overview + staffing/tasks/handover fallback；當班抽屜以 `staffing.currentOnDuty` 依館別/職位/人員分層 | 單館 detail 完整員工視角留 post-launch | 上線後補 facility detail |
| tasks | 任務管理 | 95% | 完成：主管派發、編輯、完成、取消、刪除；新增任務改為右側 drawer | 完成：同館權限、5W1H metadata、audit 與 `/api/tasks` | 部署 DB 需驗證 | Replit 實測 task lifecycle |
| handover | 交接管理 | 95% | 完成：主管交接頁與 API；建立交辦不再要求固定班別 | 完成：operational handover table，後端自動補 targetDate/targetShiftLabel 舊 schema 欄位 | 舊 API 仍在 portal namespace | 上線後搬入 module route |
| announcements | 公告管理 | 95% | 完成：手動發布、類型、置頂、啟用/停用、發布/下架時間、候選審核 | 完成：system_announcements + audit；員工 BFF 讀取 pinned/type/time | 需部署套用 `0006` | Replit 驗證 system_announcements CRUD |
| anomalies | 異常審核 | 90% | 完成：異常列表、搜尋、處理/重開、刪除 | 完成：resolve metadata + audit | routes.ts 偏肥 | 上線後拆 module route |
| facilities | 人力狀態 / 場館 | 95% | 完成：授權場館卡、場館篩選、人員/當班/下一班列表、首頁當班人員抽屜、單館 detail route | 部分完成：Ragic/session snapshot；當班抽屜已依營運中場館 -> 職位 -> 人員呈現；`/supervisor/facilities/:facilityKey` 已接 dashboard card 進入 | HR truth 外部；單館 detail 尚未嵌完整員工視角 | post-launch 補 role snapshot sync 與完整員工視角 |
| analytics | 報表分析 | 90% | 完成：主管 KPI、事件趨勢、熱門操作、CSV 匯出 | 完成：portal analytics + supervisor BFF，不再依賴 system overview | 正式 report DTO 未定版 | post-launch 定版報表 DTO |
| quick-links | 快速入口 / 常用連結 | 85% | 完成：員工常用文件與既有 portal 管理；主管設定頁已移除 | 完成：CRUD API | 主管端專用管理入口暫停 | 需要時改由現有常用文件/Portal manage 管理，不重啟 `/supervisor/settings` |

## System

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| system-dashboard | 系統儀表板 | 70% | 完成：system overview alias | 部分完成：mock/real source fallback | `/api/bff/system/dashboard` 為 alias | 下一輪定正式 DTO |
| system-health | 系統健康 | 80% | 完成：health/integration overview | 完成：adapter config health | observability still lightweight | 接 module health DB audit |
| system-observability | 系統觀測 | 65% | 部分完成：module health API、adapter health overview | 部分完成：non-mock profile 走 DB-backed telemetry repository | 尚未完整串 integration_error_logs / sync_job_runs | Replit 驗證 DB 寫入後補 sync observability |
| telemetry-audit | 操作稽核 | 70% | 部分完成：ui-events/client-error/module-events、domain writes audit caller 已大量接線 | 部分完成：DB-backed `ui_events` / `client_errors` / `audit_logs` repository 已存在；本機無 DB 實測 | OpenTelemetry SDK 與 trace/metric/log taxonomy 未正式接 | Replit 驗證 audit rows，下一輪補 trace/metric/log correlation |
| raw-inspector | Raw Inspector | 55% | 部分完成：system-only route、白名單 endpoint 檢視、查詢會送 telemetry event | 部分完成：health 驗證 supervisor 不可見 | 缺 SYSTEM_ADMIN hard guard、server-side query audit、正式 raw data policy | 補 SYSTEM_ADMIN policy 與 audit-backed query log 後才可開放 |
| integrations | 整合監控 | 60% | 部分完成：integration overview | 部分完成：adapter health | sync job runner 未接 | 接 sync_job_runs writer |
| module-registry | 模組註冊中心 | 80% | 完成：registry/navigation/home-layout/health API | 完成：descriptor/policy/smoke；目前 43 modules / 51 descriptors | `portal-manage`, `gmail-integration`, `file-upload-export`, `legacy-users`, `user-role-snapshots`, `widget-layout-settings` 尚未接 BFF | 接 no-BFF module policy；debug system registry endpoint 補 SYSTEM_ADMIN guard |

## SYSTEM_ADMIN

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| auth | 權限與 Session | 60% | 部分完成：cookie session、role/facility switch | 部分完成：localStorage 已不作權限真相 | session index hardening 未完成 | 接 DB session/audit |
| hr-audit | HR 權限稽核 | 40% | 部分完成：頁面與 registry | 未完成：正式稽核流程 | Ragic truth 外部 | 建 sync + audit writer |
| module-settings | 模組設定 | paused | 已暫停：不列入近期施工與上線範圍 | 未完成：DB persistence 不再作為當前目標 | 產品需求未收斂，避免做出半套設定器 | 未來若重啟，需先重寫 UX 規格與權限 ADR |

## Role Summary

| role | ready modules | unfinished modules | main blocker |
| --- | ---: | ---: | --- |
| employee | 13 | 10 | weather/checkins/booking/full-text still incomplete；desktop 左側導覽已收斂為指定 7 項 |
| supervisor | 21 | 8 | deployment-ready；remaining gaps are post-launch module route extraction, formal report DTO, and full facility detail |
| system | 11 | 24 | Raw Inspector / debug registry hard guard、observability DB 驗證、no-BFF module policy |
