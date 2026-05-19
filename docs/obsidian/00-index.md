# 400QIAN 模組治理索引

這份資料是從 `shared/modules` registry 產生的 Obsidian-style 模組知識庫。它的用途是讓每個功能都能回到三個治理欄位：角色、RAGIC / 資料庫、功能 / 需求 / 用途。

快速入口：[[shared-surfaces|共用區塊]] / [[bff-reference-map|BFF Reference Map]] / [[bff-technical-spec|BFF 技術規範]] / [[400line-management-blueprint|400LINE 管理藍圖]] / [[400line-api-readiness|400LINE API Readiness]] / [[system-modules-disambiguation|System Modules Disambiguation]] / [[partial-implementation-audit|Partial Implementation Audit]] / [[cleanup-backlog|Cleanup Backlog]]

## Scorecard

| Item | Value |
| --- | --- |
| Current architecture score | 80 / 100 |
| Registered modules | 78 |
| Architecture grouped modules | 78 / 78 |
| Suspicious unbound modules | 0 |
| Generated date | 2026-05-18 |

## Cleaning Progress

- Phase 1: 建立 `docs/obsidian` 與 module intake governance 欄位。
- Phase 1: 對齊 App runtime route 與 governance gate，移除獨立 `/system/topology` route drift。
- Phase 1: 補齊 type-check / smoke gate 的扣分項，並保留拆檔 backlog。
- Phase 1: 模組頁已補上功能邏輯與資料寫法 / 寫入規則。
- Phase 1: 模組頁已補上 UI/UX 邏輯、BFF 參照 / 修改關聯，並建立 [[bff-reference-map]]。
- Phase 1: 建立 [[bff-technical-spec]]，供人類與 LLM 修改 BFF / DTO / UI 時遵循。
- Phase 1: 建立 [[system-modules-disambiguation]] 與 [[partial-implementation-audit]]，處理模組命名 overlap 與 partial 過多問題。
- Next: 依 domain ownership 拆大檔，先從 employee home、system routes、storage、schema 的穩定邊界開始。

## Counts

### Status

| Status | Count |
| --- | --- |
| deprecated | 1 |
| external | 1 |
| implemented | 29 |
| legacy | 11 |
| partial | 35 |
| planned | 1 |

### Domain

| Domain | Count |
| --- | --- |
| core | 17 |
| derived | 9 |
| integration | 8 |
| legacy | 4 |
| support | 24 |
| system | 16 |

### Source Of Truth

| Source | Count |
| --- | --- |
| external | 16 |
| legacy | 4 |
| none | 2 |
| postgres | 36 |
| private | 1 |
| projection | 8 |
| telemetry | 11 |

## 入口、身分與場館權限

登入、角色、activeFacility、首頁 shell 與權限快照，是所有工作台的母系統。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/auth|auth]] | Authentication and Session | implemented | employee, lifeguard, supervisor, system, SYSTEM_ADMIN | workbench | yes |
| [[modules/dashboard|dashboard]] | Dashboard | implemented | employee, lifeguard, supervisor, system | workbench | yes |
| [[modules/employee-home|employee-home]] | 員工首頁 | implemented | employee | workbench | yes |
| [[modules/facilities|facilities]] | Facilities | partial | employee, lifeguard, supervisor, system | api-only | yes |
| [[modules/legacy-users|legacy-users]] | Legacy Users | legacy | system, SYSTEM_ADMIN | api-only | yes |
| [[modules/lifeguard-home|lifeguard-home]] | 救生首頁 | partial | lifeguard | workbench | yes |
| [[modules/session-governance|session-governance]] | Session Governance | partial | system, SYSTEM_ADMIN | api-only | yes |
| [[modules/supervisor-dashboard|supervisor-dashboard]] | 主管儀表板 | partial | supervisor | workbench | yes |
| [[modules/system-dashboard|system-dashboard]] | 系統總覽 | legacy | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/user-role-snapshots|user-role-snapshots]] | User Role Snapshots | partial | system, SYSTEM_ADMIN | api-only | yes |

## 員工內容與日常工作

員工首頁、活動、文件、教材、場租查看與日常資料卡。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/activity-periods|activity-periods]] | 活動檔期 / 課程快訊 | partial | employee, supervisor | workbench | yes |
| [[modules/campaigns-events|campaigns-events]] | Campaigns and Events | partial | employee, lifeguard, supervisor | workbench | yes |
| [[modules/checkins|checkins]] | 點名 / 報到 | planned | employee | workbench | yes |
| [[modules/employee-resources|employee-resources]] | Employee Resources | implemented | employee, lifeguard, supervisor | workbench | yes |
| [[modules/employee-settings|employee-settings]] | 員工設定 | partial | employee | workbench | yes |
| [[modules/employee-training|employee-training]] | Employee Training | partial | employee, lifeguard, supervisor, system | workbench | yes |
| [[modules/group-broadcasts|group-broadcasts]] | 群組重要公告 | implemented | employee, lifeguard, supervisor, system | workbench | yes |
| [[modules/quick-links|quick-links]] | Quick Links | implemented | employee, lifeguard, supervisor | workbench | yes |
| [[modules/registration-courses|registration-courses]] | 報名 / 課程 | partial | employee | workbench | yes |
| [[modules/search|search]] | 快速搜尋 | partial | employee, lifeguard, supervisor, system | workbench | yes |

## 救生作業與稽核

救生首頁、照片/GPS 作業、失物、水道事項、主管觀察與 IT 稽核。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/lifeguard-cleanup|lifeguard-cleanup]] | 下班打掃 | partial | lifeguard | workbench | yes |
| [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | 教練下水 | partial | lifeguard | workbench | yes |
| [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | 水道事項 | partial | lifeguard | workbench | yes |
| [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | 水道租借狀態 | partial | lifeguard | workbench | yes |
| [[modules/lifeguard-log|lifeguard-log]] | 救生員日誌 | partial | lifeguard, supervisor, system | workbench | yes |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | 失物招領 | partial | lifeguard, employee | workbench | yes |
| [[modules/lifeguard-water-quality|lifeguard-water-quality]] | 水質檢測 | partial | lifeguard | workbench | yes |
| [[modules/supervisor-lifeguard-overview|supervisor-lifeguard-overview]] | 救生紀錄總覽 | partial | supervisor, system | workbench | yes |

## 主管營運模組

主管端停車、櫃台日誌、水道租借、場地預約、任務、交接、異常與報表。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/analytics|analytics]] | Analytics | partial | supervisor, system | workbench | yes |
| [[modules/anomalies|anomalies]] | Anomalies | implemented | supervisor, system | workbench | yes |
| [[modules/counter-log|counter-log]] | Counter Log | partial | supervisor, system | workbench | yes |
| [[modules/courts|courts]] | Courts | partial | employee, supervisor, system | workbench | yes |
| [[modules/handover|handover]] | 櫃台交接 | implemented | employee, lifeguard, supervisor | workbench | yes |
| [[modules/lane-rentals|lane-rentals]] | Lane Rentals | implemented | supervisor, system | workbench | yes |
| [[modules/operations|operations]] | Operations | legacy | system, supervisor | legacy-route | yes |
| [[modules/parking|parking]] | Parking Management | implemented | supervisor, system | workbench | yes |
| [[modules/parking-contracts|parking-contracts]] | Parking Contracts | implemented | supervisor, system | workbench | yes |
| [[modules/parking-event-days|parking-event-days]] | Parking Event Days | implemented | supervisor, system | workbench | yes |
| [[modules/parking-payments|parking-payments]] | Parking Payments | implemented | supervisor, system | workbench | yes |
| [[modules/parking-plans|parking-plans]] | Parking Plans | implemented | supervisor, system | workbench | yes |
| [[modules/parking-vehicles|parking-vehicles]] | Parking Vehicles | implemented | supervisor, system | workbench | yes |

## 公告、通知與知識

系統公告、LINE 群組公告、公告審核、收件人、通知與問答知識庫。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/announcement-groups|announcement-groups]] | Announcement Groups | implemented | supervisor, system | workbench | yes |
| [[modules/announcement-review|announcement-review]] | Announcement Review | partial | supervisor, system | workbench | yes |
| [[modules/announcement-summary|announcement-summary]] | Announcement Summary | partial | supervisor, system | legacy-route | yes |
| [[modules/announcements|announcements]] | Announcements | implemented | employee, lifeguard, supervisor, system | workbench | yes |
| [[modules/knowledge-base-qna|knowledge-base-qna]] | 相關問題詢問 | partial | employee, lifeguard, supervisor | workbench | yes |
| [[modules/notification-center|notification-center]] | Notification Center | partial | employee, lifeguard, supervisor, system | api-only | yes |
| [[modules/notification-recipients|notification-recipients]] | Notification Recipients | implemented | system, supervisor | legacy-route | yes |
| [[modules/system-announcements|system-announcements]] | System Announcements | implemented | employee, lifeguard, supervisor, system | workbench | yes |

## IT 治理與觀察面

功能關係、拓撲摘要、健康檢查、稽核、Watchdog 與 BFF projections。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/bff-projections|bff-projections]] | BFF Projections | partial | system, SYSTEM_ADMIN | api-only | yes |
| [[modules/helper-status|helper-status]] | 400LINE 服務監控 | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/hr-audit|hr-audit]] | HR Audit | partial | system, SYSTEM_ADMIN | legacy-route | yes |
| [[modules/line-whitelist|line-whitelist]] | 400 LINE 白名單管理 | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/linebot-management|linebot-management]] | 400LINE 管理 | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-control-center|system-control-center]] | 系統控制中心 | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-function-relations|system-function-relations]] | 當前功能關係 | legacy | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-governance|system-governance]] | 治理面 | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-health|system-health]] | System Health | legacy | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-insights|system-insights]] | 行為洞察 | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-observability|system-observability]] | System Observability | legacy | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-operations|system-operations]] | 運維協助中心 | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/system-watchdog|system-watchdog]] | Watchdog | implemented | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/telemetry-audit|telemetry-audit]] | Telemetry and Audit | legacy | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/watchdog-events|watchdog-events]] | Watchdog Events | legacy | system, SYSTEM_ADMIN | workbench | yes |

## 外部整合

LINE Bot、排班、Ragic、Gmail、同步工作與外部資料源接線。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/booking-snapshot|booking-snapshot]] | Booking Snapshot | partial | employee, lifeguard, supervisor, system | api-only | yes |
| [[modules/gmail-integration|gmail-integration]] | Gmail SMTP Integration | partial | system | api-only | yes |
| [[modules/integration-sync-jobs|integration-sync-jobs]] | Integration Sync Jobs | legacy | system, SYSTEM_ADMIN | workbench | yes |
| [[modules/linebot-integration|linebot-integration]] | LINE Bot Assistant Integration | external | system, supervisor | api-only | yes |
| [[modules/ragic-integration|ragic-integration]] | Ragic Integration | partial | system, SYSTEM_ADMIN | api-only | yes |
| [[modules/schedule-integration|schedule-integration]] | Smart Schedule Integration | partial | system, supervisor, employee, lifeguard | api-only | yes |
| [[modules/shift-reminder|shift-reminder]] | Shift Reminder | partial | employee, lifeguard, supervisor | workbench | yes |
| [[modules/weather-widget|weather-widget]] | 天氣卡片 | implemented | employee | api-only | yes |

## Legacy / 相容層

舊 portal、舊使用者、舊版面設定與仍保留相容的檔案匯出上傳。

| Module | Label | Status | Roles | Entry | BFF |
| --- | --- | --- | --- | --- | --- |
| [[modules/file-upload-export|file-upload-export]] | File Upload and Export | legacy | system, supervisor | api-only | yes |
| [[modules/portal-analytics|portal-analytics]] | Portal Analytics | implemented | supervisor, system | workbench | yes |
| [[modules/portal-home|portal-home]] | Portal Home | legacy | employee, lifeguard | legacy-route | yes |
| [[modules/portal-manage|portal-manage]] | Portal Manage | partial | supervisor, system | legacy-route | yes |
| [[modules/portal-review|portal-review]] | Portal Review | partial | supervisor, system | legacy-route | yes |
| [[modules/widget-layout-settings|widget-layout-settings]] | Widget Layout Settings | deprecated | system | api-only | no |
