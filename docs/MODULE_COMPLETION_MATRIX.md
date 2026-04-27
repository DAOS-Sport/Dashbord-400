# Module Completion Matrix

Date: 2026-04-27

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
| search | 快速搜尋 | 60% | 部分完成：搜尋模組名稱/關鍵字 | 部分完成：`/api/search/global` registry-backed stub | 未接全文搜尋 | 下一輪擴到 announcements/handover/shifts |
| checkins | 點名 / 打卡 | 20% | 未完成：入口註冊 | 未完成：尚未有正式 DTO/API | 資料來源未定 | 先定 attendance BFF contract |
| knowledge-base-qna | 知識 Q&A | 20% | 未完成：註冊與 not_connected | 未完成：無 KB provider | 不可新增 RAG/vector store | 先定 curated content source |
| personal-note | 個人記事 | 60% | 部分完成：employee_resources sticky note | 部分完成：CRUD 共用 employee resources | 不是獨立 personal-note table | 補 owner policy 與 UI 驗收 |
| activity-periods | 活動檔期 | 70% | 完成：正式 `/employee/activity-periods` 深藍卡片頁、分類 filter、empty state | 部分完成：沿用 employee home campaigns BFF，尚未有專屬 BFF policy | 來源混合 | 收斂到 campaigns-events DTO |
| registration-courses | 報名 / 課程 | 20% | 未完成：入口註冊 | 未完成：booking provider 未接 | 無正式課程資料 | 接 booking adapter |

## Supervisor

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| supervisor-dashboard | 主管儀表板 | 70% | 完成：主管首頁與 BFF 摘要 | 部分完成：staffing/tasks/handover fallback | projection 與 local table 混合 | 建主管 dashboard DTO contract test |
| tasks | 任務管理 | 80% | 完成：主管派發、編輯、完成、取消、刪除 | 完成：同館權限與 `/api/tasks` | 部署 DB 需 migration | 補 supervisor API smoke |
| handover | 交接管理 | 80% | 完成：主管交接頁與 API | 完成：operational handover table | 舊 API 還在 portal namespace | 搬入 module route |
| announcements | 公告管理 | 60% | 部分完成：員工讀取、主管頁存在 | 部分完成：ack 已接，審核仍 LINE proxy | 發布/審核治理未統一 | 建 review/audit policy |
| anomalies | 異常審核 | 80% | 完成：legacy anomaly page/API | 部分完成：audit/notification coupling | routes.ts 偏肥 | 拆到 module |
| facilities | 人力狀態 / 場館 | 60% | 部分完成：people page | 部分完成：Ragic/session snapshot | HR truth 外部 | 補 role snapshot sync |
| analytics | 報表分析 | 60% | 部分完成：頁面與 telemetry overview | 部分完成：event tables/schema | 指標未定版 | 定 report DTO |
| quick-links | 系統設定 / 快速入口 | 80% | 完成：主管維護入口 | 完成：CRUD API | 需 module settings merge | 接 module_settings |

## System

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| system-dashboard | 系統儀表板 | 70% | 完成：system overview alias | 部分完成：mock/real source fallback | `/api/bff/system/dashboard` 為 alias | 下一輪定正式 DTO |
| system-health | 系統健康 | 80% | 完成：health/integration overview | 完成：adapter config health | observability still lightweight | 接 module health DB audit |
| system-observability | 系統觀測 | 60% | 部分完成：module health API | 部分完成：telemetry memory repo | DB repository 未啟用 | migration 後啟用 DB repo |
| telemetry-audit | 操作稽核 | 60% | 部分完成：ui-events/client-error/module-events | 部分完成：audit tables/schema | OpenTelemetry 未正式接 SDK | 補 trace/metric/log correlation |
| raw-inspector | Raw Inspector | 60% | 部分完成：system-only route | 部分完成：health 驗證 supervisor 不可見 | 仍需 audit guard | 補 SYSTEM_ADMIN policy |
| integrations | 整合監控 | 60% | 部分完成：integration overview | 部分完成：adapter health | sync job runner 未接 | 接 sync_job_runs writer |
| module-registry | 模組註冊中心 | 80% | 完成：registry/navigation/home-layout/health API | 完成：descriptor/policy/smoke | settings PATCH 尚未持久化 | 接 module_settings persistence |

## SYSTEM_ADMIN

| moduleId | 中文名稱 | 完成度 | 功能狀態 | 邏輯狀態 | 問題 | 修復策略 |
| --- | --- | ---: | --- | --- | --- | --- |
| auth | 權限與 Session | 60% | 部分完成：cookie session、role/facility switch | 部分完成：localStorage 已不作權限真相 | session index hardening 未完成 | 接 DB session/audit |
| hr-audit | HR 權限稽核 | 40% | 部分完成：頁面與 registry | 未完成：正式稽核流程 | Ragic truth 外部 | 建 sync + audit writer |
| module-settings | 模組設定 | 40% | 部分完成：PATCH endpoint registered | 未完成：DB persistence | migration added but service not persisted | 下一輪接 module_settings storage |

## Role Summary

| role | ready modules | unfinished modules | main blocker |
| --- | ---: | ---: | --- |
| employee | 12 | 11 | weather/checkins/Q&A/booking/search full-text not connected；desktop 左側導覽已收斂為指定 7 項 |
| supervisor | 14 | 19 | announcement governance and analytics/report DTO not finalized |
| system | 11 | 24 | observability/audit DB repository and module settings persistence |
