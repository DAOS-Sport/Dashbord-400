# BFF Reference Map

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[bff-technical-spec|BFF 技術規範]] / [[cleanup-backlog|清洗 backlog]]

這張表是給修改 BFF / DTO / UI section 時反查影響範圍用。規則是：任何 UI 新欄位先回到 BFF contract；任何 BFF 新資料先回到 module registry；任何寫入都要看資料權威、query refresh、telemetry/audit。具體寫法見 [[bff-technical-spec]]。

## BFF Change Rules

- UI 不直接呼叫外部服務；外部資料先進 server adapter / BFF，再轉成 shared domain DTO。
- BFF section 必須能表達 ready / empty / degraded / unavailable；頁面只渲染狀態，不自行判斷外部服務細節。
- 新增欄位時同步更新 shared domain type、server mapper、page component、module page。
- 寫入 API 完成後要定義 query invalidation / projection refresh / audit event，不只回傳 success。
- 系統頁與白名單頁維持高資訊密度，避免把治理工具做成 landing page 或展示型版面。

## Module BFF Bindings

| Module | Label | Binding | Roles | UI Surface |
| --- | --- | --- | --- | --- |
| [[modules/auth|auth]] | Authentication and Session | plannedEndpoint: `/api/auth/me` | employee, lifeguard, supervisor, system, SYSTEM_ADMIN | system governance surface |
| [[modules/dashboard|dashboard]] | Dashboard | employeeSectionKey: `home`<br>supervisorSectionKey: `dashboard`<br>systemSectionKey: `overview`<br>plannedEndpoint: `/api/bff/employee/home`<br>plannedEndpoint: `/api/bff/supervisor/dashboard`<br>plannedEndpoint: `/api/bff/system/overview` | employee, lifeguard, supervisor, system | home-card / dashboard widget |
| [[modules/employee-home|employee-home]] | 員工首頁 | employeeSectionKey: `home`<br>plannedEndpoint: `/api/bff/employee/home` | employee | home-card / dashboard widget |
| [[modules/lifeguard-home|lifeguard-home]] | 救生首頁 | employeeSectionKey: `lifeguardHome`<br>plannedEndpoint: `/api/bff/lifeguard/home` | lifeguard | home-card / dashboard widget |
| [[modules/lifeguard-log|lifeguard-log]] | 救生員日誌 | employeeSectionKey: `lifeguardLog`<br>supervisorSectionKey: `lifeguardLog` | lifeguard, supervisor, system | home-card / dashboard widget |
| [[modules/supervisor-dashboard|supervisor-dashboard]] | 主管儀表板 | supervisorSectionKey: `dashboard`<br>plannedEndpoint: `/api/bff/supervisor/dashboard` | supervisor | home-card / dashboard widget |
| [[modules/system-dashboard|system-dashboard]] | 系統總覽 | systemSectionKey: `overview`<br>plannedEndpoint: `/api/bff/system/overview` | system, SYSTEM_ADMIN | role detail page |
| [[modules/system-control-center|system-control-center]] | 系統控制中心 | systemSectionKey: `controlCenter`<br>plannedEndpoint: `/api/bff/system/control-center` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/system-watchdog|system-watchdog]] | Watchdog | systemSectionKey: `watchdog`<br>plannedEndpoint: `/api/bff/system/watchdog-events`<br>plannedEndpoint: `/api/bff/system/integration-overview` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/system-operations|system-operations]] | 運維協助中心 | systemSectionKey: `operations`<br>plannedEndpoint: `/api/bff/system/operations/user-search`<br>plannedEndpoint: `/api/bff/system/operations/user/:userId`<br>plannedEndpoint: `/api/bff/system/operations/user/:userId/reset-session`<br>plannedEndpoint: `/api/bff/system/operations/user/:userId/refresh-cache`<br>plannedEndpoint: `/api/bff/system/operations/user/:userId/resend-notification`<br>plannedEndpoint: `/api/bff/system/operations/recent-assists` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/system-insights|system-insights]] | 行為洞察 | systemSectionKey: `insights`<br>plannedEndpoint: `/api/bff/system/insights/overview`<br>plannedEndpoint: `/api/bff/system/insights/module/:moduleId` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/system-governance|system-governance]] | 治理面 | systemSectionKey: `governance`<br>plannedEndpoint: `/api/modules/registry`<br>plannedEndpoint: `/api/audit/logs` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/linebot-management|linebot-management]] | 400LINE 管理 | systemSectionKey: `linebotManagement`<br>plannedEndpoint: `/api/bff/system/linebot-management/overview`<br>plannedEndpoint: `/api/bff/system/linebot-management/services`<br>plannedEndpoint: `/api/bff/system/linebot-management/facilities`<br>plannedEndpoint: `/api/bff/system/linebot-management/whitelist-snapshot`<br>plannedEndpoint: `/api/bff/system/linebot-management/announcement-pipeline` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/helper-status|helper-status]] | 400LINE 服務監控 | systemSectionKey: `helperStatus`<br>plannedEndpoint: `/api/bff/system/helper-status` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/line-whitelist|line-whitelist]] | 400 LINE 白名單管理 | systemSectionKey: `lineWhitelist`<br>plannedEndpoint: `/api/bff/system/line-whitelist`<br>plannedEndpoint: `/api/bff/system/line-whitelist/candidates`<br>plannedEndpoint: `/api/internal/line-whitelist/check`<br>plannedEndpoint: `/api/cms/system/caution-permissions`<br>plannedEndpoint: `/api/cms/system/caution-permissions/candidates`<br>plannedEndpoint: `/api/cms/system/caution-permissions/check` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/lifeguard-water-quality|lifeguard-water-quality]] | 水質檢測 | plannedEndpoint: `/api/bff/lifeguard/home`<br>plannedEndpoint: `/api/bff/lifeguard/records` | lifeguard | home-card / dashboard widget |
| [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | 教練下水 | plannedEndpoint: `/api/bff/lifeguard/home` | lifeguard | home-card / dashboard widget |
| [[modules/lifeguard-cleanup|lifeguard-cleanup]] | 下班打掃 | plannedEndpoint: `/api/bff/lifeguard/home` | lifeguard | home-card / dashboard widget |
| [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | 水道事項 | plannedEndpoint: `/api/bff/lifeguard/home` | lifeguard | home-card / dashboard widget |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | 失物招領 | plannedEndpoint: `/api/bff/employee/lost-and-found`<br>plannedEndpoint: `/api/bff/lifeguard/home`<br>plannedEndpoint: `/api/bff/lifeguard/lost-and-found` | lifeguard, employee | home-card / dashboard widget |
| [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | 水道租借狀態 | plannedEndpoint: `/api/bff/lifeguard/lane-rentals` | lifeguard | home-card / dashboard widget |
| [[modules/supervisor-lifeguard-overview|supervisor-lifeguard-overview]] | 救生紀錄總覽 | supervisorSectionKey: `lifeguardOverview`<br>plannedEndpoint: `/api/bff/supervisor/lifeguard-overview` | supervisor, system | role detail page |
| [[modules/system-function-relations|system-function-relations]] | 當前功能關係 | systemSectionKey: `functionRelations` | system, SYSTEM_ADMIN | role detail page |
| [[modules/analytics|analytics]] | Analytics | supervisorSectionKey: `reports`<br>systemSectionKey: `uiEventOverview`<br>plannedEndpoint: `/api/bff/system/ui-event-overview` | supervisor, system | admin management surface |
| [[modules/operations|operations]] | Operations | plannedEndpoint: `/api/bff/supervisor/dashboard` | system, supervisor | admin management surface |
| [[modules/counter-log|counter-log]] | Counter Log | supervisorSectionKey: `counterLog` | supervisor, system | home-card / dashboard widget |
| [[modules/lane-rentals|lane-rentals]] | Lane Rentals | supervisorSectionKey: `laneRentals` | supervisor, system | home-card / dashboard widget |
| [[modules/courts|courts]] | Courts | supervisorSectionKey: `courts` | employee, supervisor, system | home-card / dashboard widget |
| [[modules/parking|parking]] | Parking Management | supervisorSectionKey: `parking` | supervisor, system | home-card / dashboard widget |
| [[modules/parking-vehicles|parking-vehicles]] | Parking Vehicles | supervisorSectionKey: `parkingVehicles` | supervisor, system | admin management surface |
| [[modules/parking-plans|parking-plans]] | Parking Plans | supervisorSectionKey: `parkingPlans` | supervisor, system | admin management surface |
| [[modules/parking-contracts|parking-contracts]] | Parking Contracts | supervisorSectionKey: `parkingContracts` | supervisor, system | admin management surface |
| [[modules/parking-payments|parking-payments]] | Parking Payments | supervisorSectionKey: `parkingPayments` | supervisor, system | admin management surface |
| [[modules/parking-event-days|parking-event-days]] | Parking Event Days | supervisorSectionKey: `parkingEventDays` | supervisor, system | admin management surface |
| [[modules/hr-audit|hr-audit]] | HR Audit | systemSectionKey: `audit`<br>plannedEndpoint: `/api/hr-audit` | system, SYSTEM_ADMIN | admin management surface |
| [[modules/system-health|system-health]] | System Health | systemSectionKey: `health`<br>plannedEndpoint: `/api/bff/system/health-overview`<br>plannedEndpoint: `/api/bff/system/integration-overview` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/announcements|announcements]] | Announcements | employeeSectionKey: `announcements`<br>supervisorSectionKey: `announcementAcks`<br>plannedEndpoint: `/api/bff/employee/home` | employee, lifeguard, supervisor, system | home-card / dashboard widget |
| [[modules/announcement-groups|announcement-groups]] | Announcement Groups | employeeSectionKey: `announcements`<br>supervisorSectionKey: `announcementGroups`<br>plannedEndpoint: `/api/bff/employee/home`<br>plannedEndpoint: `/api/integrations/announcement-groups/messages` | supervisor, system | admin management surface |
| [[modules/announcement-review|announcement-review]] | Announcement Review | supervisorSectionKey: `announcementReview`<br>plannedEndpoint: `/api/announcement-candidates` | supervisor, system | admin management surface |
| [[modules/announcement-summary|announcement-summary]] | Announcement Summary | supervisorSectionKey: `announcementSummary`<br>plannedEndpoint: `/api/announcement-dashboard/summary` | supervisor, system | admin management surface |
| [[modules/system-announcements|system-announcements]] | System Announcements | employeeSectionKey: `announcements`<br>supervisorSectionKey: `announcements` | employee, lifeguard, supervisor, system | home-card / dashboard widget |
| [[modules/tasks|tasks]] | Tasks | employeeSectionKey: `tasks`<br>supervisorSectionKey: `incompleteTasks`<br>plannedEndpoint: `/api/bff/employee/home`<br>plannedEndpoint: `/api/bff/supervisor/dashboard` | employee, lifeguard, supervisor | home-card / dashboard widget |
| [[modules/handover|handover]] | 櫃台交接 | employeeSectionKey: `handover`<br>supervisorSectionKey: `handoverOverview` | employee, lifeguard, supervisor | home-card / dashboard widget |
| [[modules/anomalies|anomalies]] | Anomalies | supervisorSectionKey: `pendingAnomalies`<br>systemSectionKey: `alerts` | supervisor, system | home-card / dashboard widget |
| [[modules/notification-recipients|notification-recipients]] | Notification Recipients | plannedEndpoint: `/api/notification-recipients` | system, supervisor | admin management surface |
| [[modules/campaigns-events|campaigns-events]] | Campaigns and Events | employeeSectionKey: `campaigns` | employee, lifeguard, supervisor | home-card / dashboard widget |
| [[modules/booking-snapshot|booking-snapshot]] | Booking Snapshot | employeeSectionKey: `bookingSnapshot`<br>plannedEndpoint: `/api/bff/employee/home` | employee, lifeguard, supervisor, system | home-card / dashboard widget |
| [[modules/shift-reminder|shift-reminder]] | Shift Reminder | employeeSectionKey: `shifts`<br>supervisorSectionKey: `shifts`<br>systemSectionKey: `scheduleSnapshot`<br>plannedEndpoint: `/api/bff/system/schedule-snapshot` | employee, lifeguard, supervisor | home-card / dashboard widget |
| [[modules/quick-links|quick-links]] | Quick Links | employeeSectionKey: `shortcuts` | employee, lifeguard, supervisor | home-card / dashboard widget |
| [[modules/notification-center|notification-center]] | Notification Center | employeeSectionKey: `notifications`<br>supervisorSectionKey: `notifications`<br>systemSectionKey: `notifications` | employee, lifeguard, supervisor, system | home-card / dashboard widget |
| [[modules/knowledge-base-qna|knowledge-base-qna]] | 相關問題詢問 | employeeSectionKey: `qna` | employee, lifeguard, supervisor | home-card / dashboard widget |
| [[modules/personal-note|personal-note]] | 個人工作貼 | employeeSectionKey: `stickyNotes` | employee, lifeguard | home-card / dashboard widget |
| [[modules/activity-periods|activity-periods]] | 活動檔期 / 課程快訊 | employeeSectionKey: `events` | employee, supervisor | home-card / dashboard widget |
| [[modules/registration-courses|registration-courses]] | 報名 / 課程 | employeeSectionKey: `registrationCourses` | employee | home-card / dashboard widget |
| [[modules/checkins|checkins]] | 點名 / 報到 | employeeSectionKey: `checkins` | employee | home-card / dashboard widget |
| [[modules/employee-settings|employee-settings]] | 員工設定 | employeeSectionKey: `settings` | employee | role detail page |
| [[modules/search|search]] | 快速搜尋 | employeeSectionKey: `search`<br>supervisorSectionKey: `search`<br>systemSectionKey: `search` | employee, lifeguard, supervisor, system | home-card / dashboard widget |
| [[modules/weather-widget|weather-widget]] | 天氣卡片 | employeeSectionKey: `weather` | employee | home-card / dashboard widget |
| [[modules/portal-home|portal-home]] | Portal Home | employeeSectionKey: `home`<br>plannedEndpoint: `/api/bff/employee/home` | employee, lifeguard | home-card / dashboard widget |
| [[modules/portal-review|portal-review]] | Portal Review | supervisorSectionKey: `announcementReview` | supervisor, system | legacy portal surface |
| [[modules/portal-analytics|portal-analytics]] | Portal Analytics | supervisorSectionKey: `portalAnalytics`<br>systemSectionKey: `portalAnalytics` | supervisor, system | legacy portal surface |
| [[modules/system-observability|system-observability]] | System Observability | systemSectionKey: `observability`<br>plannedEndpoint: `/api/bff/system/overview` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/telemetry-audit|telemetry-audit]] | Telemetry and Audit | systemSectionKey: `audit`<br>plannedEndpoint: `/api/bff/system/ui-event-overview` | system, SYSTEM_ADMIN | admin management surface |
| [[modules/linebot-integration|linebot-integration]] | LINE Bot Assistant Integration | plannedEndpoint: `/api/bff/employee/home`<br>plannedEndpoint: `/api/bff/system/line-bot/service-status`<br>plannedEndpoint: `/api/bff/system/line-bot/service-status/snapshots`<br>plannedEndpoint: `/api/internal/service-health` | system, supervisor | system governance surface |
| [[modules/schedule-integration|schedule-integration]] | Smart Schedule Integration | employeeSectionKey: `shifts`<br>supervisorSectionKey: `staffing`<br>systemSectionKey: `scheduleSnapshot`<br>plannedEndpoint: `/api/bff/system/schedule-snapshot` | system, supervisor, employee, lifeguard | system governance surface |
| [[modules/ragic-integration|ragic-integration]] | Ragic Integration | plannedEndpoint: `/api/auth/me` | system, SYSTEM_ADMIN | system governance surface |
| [[modules/facilities|facilities]] | Facilities | plannedEndpoint: `/api/auth/me` | employee, lifeguard, supervisor, system | background service |
| [[modules/session-governance|session-governance]] | Session Governance | plannedEndpoint: `/api/auth/me` | system, SYSTEM_ADMIN | system governance surface |
| [[modules/employee-resources|employee-resources]] | Employee Resources | employeeSectionKey: `documents`<br>supervisorSectionKey: `settings` | employee, lifeguard, supervisor | home-card / dashboard widget |
| [[modules/employee-training|employee-training]] | Employee Training | employeeSectionKey: `training` | employee, lifeguard, supervisor, system | admin management surface |
| [[modules/watchdog-events|watchdog-events]] | Watchdog Events | systemSectionKey: `watchdogEvents`<br>plannedEndpoint: `/api/bff/system/watchdog-events` | system, SYSTEM_ADMIN | home-card / dashboard widget |
| [[modules/bff-projections|bff-projections]] | BFF Projections | employeeSectionKey: `home`<br>supervisorSectionKey: `dashboard`<br>systemSectionKey: `overview` | system, SYSTEM_ADMIN | system governance surface |
| [[modules/integration-sync-jobs|integration-sync-jobs]] | Integration Sync Jobs | systemSectionKey: `integrationOverview`<br>plannedEndpoint: `/api/bff/system/integration-overview` | system, SYSTEM_ADMIN | system governance surface |

## BFF Endpoints

| Endpoint | Module | Status | Section / Binding | Data Touchpoints |
| --- | --- | --- | --- | --- |
| `GET /api/bff/employee/home` | [[modules/dashboard|dashboard]] | partial | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` | `employee_home_projection`<br>`supervisor_dashboard_projection`<br>`system_overview_projection` |
| `GET /api/bff/supervisor/dashboard` | [[modules/dashboard|dashboard]] | partial | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` | `employee_home_projection`<br>`supervisor_dashboard_projection`<br>`system_overview_projection` |
| `GET /api/bff/system/overview` | [[modules/dashboard|dashboard]] | partial | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` | `employee_home_projection`<br>`supervisor_dashboard_projection`<br>`system_overview_projection` |
| `GET /api/bff/employee/home` | [[modules/employee-home|employee-home]] | implemented | `home`<br>`/api/bff/employee/home` | `employee_home_projection`<br>`operational_handovers`<br>`employee_resources` |
| `GET /api/bff/lifeguard/home` | [[modules/lifeguard-home|lifeguard-home]] | partial | `lifeguardHome`<br>`/api/bff/lifeguard/home` | `lifeguard_*`<br>`daily_report_submissions` |
| `GET /api/bff/lifeguard/home` | [[modules/lifeguard-log|lifeguard-log]] | partial | `lifeguardLog`<br>`lifeguardLog` | `work_log_task_completions`<br>`water_quality_records`<br>`lifeguard_handover_notes`<br>`daily_report_submissions` |
| `GET /api/bff/supervisor/dashboard` | [[modules/supervisor-dashboard|supervisor-dashboard]] | partial | `dashboard`<br>`/api/bff/supervisor/dashboard` | `supervisor_dashboard_projection` |
| `GET /api/bff/system/overview` | [[modules/system-dashboard|system-dashboard]] | partial | `overview`<br>`/api/bff/system/overview` | `system_overview_projection` |
| `GET /api/bff/system/control-center` | [[modules/system-control-center|system-control-center]] | implemented | `controlCenter`<br>`/api/bff/system/control-center` | `watchdog_events`<br>`audit_logs` |
| `GET /api/modules/health` | [[modules/system-watchdog|system-watchdog]] | implemented | `watchdog`<br>`/api/bff/system/watchdog-events`<br>`/api/bff/system/integration-overview` | `watchdog_events`<br>`integration_error_logs` |
| `GET /api/bff/system/watchdog-events` | [[modules/system-watchdog|system-watchdog]] | implemented | `watchdog`<br>`/api/bff/system/watchdog-events`<br>`/api/bff/system/integration-overview` | `watchdog_events`<br>`integration_error_logs` |
| `GET /api/bff/system/integration-overview` | [[modules/system-watchdog|system-watchdog]] | implemented | `watchdog`<br>`/api/bff/system/watchdog-events`<br>`/api/bff/system/integration-overview` | `watchdog_events`<br>`integration_error_logs` |
| `GET /api/bff/system/operations/user-search` | [[modules/system-operations|system-operations]] | implemented | `operations`<br>`/api/bff/system/operations/user-search`<br>`/api/bff/system/operations/user/:userId`<br>`/api/bff/system/operations/user/:userId/reset-session`<br>`/api/bff/system/operations/user/:userId/refresh-cache`<br>`/api/bff/system/operations/user/:userId/resend-notification`<br>`/api/bff/system/operations/recent-assists` | `users`<br>`sessions_index`<br>`audit_logs`<br>`client_errors` |
| `GET /api/bff/system/operations/user/:userId` | [[modules/system-operations|system-operations]] | implemented | `operations`<br>`/api/bff/system/operations/user-search`<br>`/api/bff/system/operations/user/:userId`<br>`/api/bff/system/operations/user/:userId/reset-session`<br>`/api/bff/system/operations/user/:userId/refresh-cache`<br>`/api/bff/system/operations/user/:userId/resend-notification`<br>`/api/bff/system/operations/recent-assists` | `users`<br>`sessions_index`<br>`audit_logs`<br>`client_errors` |
| `POST /api/bff/system/operations/user/:userId/reset-session` | [[modules/system-operations|system-operations]] | implemented | `operations`<br>`/api/bff/system/operations/user-search`<br>`/api/bff/system/operations/user/:userId`<br>`/api/bff/system/operations/user/:userId/reset-session`<br>`/api/bff/system/operations/user/:userId/refresh-cache`<br>`/api/bff/system/operations/user/:userId/resend-notification`<br>`/api/bff/system/operations/recent-assists` | `users`<br>`sessions_index`<br>`audit_logs`<br>`client_errors` |
| `POST /api/bff/system/operations/user/:userId/refresh-cache` | [[modules/system-operations|system-operations]] | implemented | `operations`<br>`/api/bff/system/operations/user-search`<br>`/api/bff/system/operations/user/:userId`<br>`/api/bff/system/operations/user/:userId/reset-session`<br>`/api/bff/system/operations/user/:userId/refresh-cache`<br>`/api/bff/system/operations/user/:userId/resend-notification`<br>`/api/bff/system/operations/recent-assists` | `users`<br>`sessions_index`<br>`audit_logs`<br>`client_errors` |
| `POST /api/bff/system/operations/user/:userId/resend-notification` | [[modules/system-operations|system-operations]] | implemented | `operations`<br>`/api/bff/system/operations/user-search`<br>`/api/bff/system/operations/user/:userId`<br>`/api/bff/system/operations/user/:userId/reset-session`<br>`/api/bff/system/operations/user/:userId/refresh-cache`<br>`/api/bff/system/operations/user/:userId/resend-notification`<br>`/api/bff/system/operations/recent-assists` | `users`<br>`sessions_index`<br>`audit_logs`<br>`client_errors` |
| `GET /api/bff/system/operations/recent-assists` | [[modules/system-operations|system-operations]] | implemented | `operations`<br>`/api/bff/system/operations/user-search`<br>`/api/bff/system/operations/user/:userId`<br>`/api/bff/system/operations/user/:userId/reset-session`<br>`/api/bff/system/operations/user/:userId/refresh-cache`<br>`/api/bff/system/operations/user/:userId/resend-notification`<br>`/api/bff/system/operations/recent-assists` | `users`<br>`sessions_index`<br>`audit_logs`<br>`client_errors` |
| `GET /api/bff/system/insights/overview` | [[modules/system-insights|system-insights]] | implemented | `insights`<br>`/api/bff/system/insights/overview`<br>`/api/bff/system/insights/module/:moduleId` | `ui_events`<br>`audit_logs` |
| `GET /api/bff/system/insights/module/:moduleId` | [[modules/system-insights|system-insights]] | implemented | `insights`<br>`/api/bff/system/insights/overview`<br>`/api/bff/system/insights/module/:moduleId` | `ui_events`<br>`audit_logs` |
| `GET /api/modules/registry` | [[modules/system-governance|system-governance]] | implemented | `governance`<br>`/api/modules/registry`<br>`/api/audit/logs` | `module_settings`<br>`audit_logs` |
| `GET /api/system/module-registry` | [[modules/system-governance|system-governance]] | implemented | `governance`<br>`/api/modules/registry`<br>`/api/audit/logs` | `module_settings`<br>`audit_logs` |
| `GET /api/bff/system/linebot-management/overview` | [[modules/linebot-management|linebot-management]] | implemented | `linebotManagement`<br>`/api/bff/system/linebot-management/overview`<br>`/api/bff/system/linebot-management/services`<br>`/api/bff/system/linebot-management/facilities`<br>`/api/bff/system/linebot-management/whitelist-snapshot`<br>`/api/bff/system/linebot-management/announcement-pipeline` | `400LINE service health snapshot`<br>`line_feature_whitelist` |
| `GET /api/bff/system/linebot-management/services` | [[modules/linebot-management|linebot-management]] | implemented | `linebotManagement`<br>`/api/bff/system/linebot-management/overview`<br>`/api/bff/system/linebot-management/services`<br>`/api/bff/system/linebot-management/facilities`<br>`/api/bff/system/linebot-management/whitelist-snapshot`<br>`/api/bff/system/linebot-management/announcement-pipeline` | `400LINE service health snapshot`<br>`line_feature_whitelist` |
| `GET /api/bff/system/linebot-management/facilities` | [[modules/linebot-management|linebot-management]] | implemented | `linebotManagement`<br>`/api/bff/system/linebot-management/overview`<br>`/api/bff/system/linebot-management/services`<br>`/api/bff/system/linebot-management/facilities`<br>`/api/bff/system/linebot-management/whitelist-snapshot`<br>`/api/bff/system/linebot-management/announcement-pipeline` | `400LINE service health snapshot`<br>`line_feature_whitelist` |
| `GET /api/bff/system/linebot-management/whitelist-snapshot` | [[modules/linebot-management|linebot-management]] | implemented | `linebotManagement`<br>`/api/bff/system/linebot-management/overview`<br>`/api/bff/system/linebot-management/services`<br>`/api/bff/system/linebot-management/facilities`<br>`/api/bff/system/linebot-management/whitelist-snapshot`<br>`/api/bff/system/linebot-management/announcement-pipeline` | `400LINE service health snapshot`<br>`line_feature_whitelist` |
| `GET /api/bff/system/linebot-management/announcement-pipeline` | [[modules/linebot-management|linebot-management]] | implemented | `linebotManagement`<br>`/api/bff/system/linebot-management/overview`<br>`/api/bff/system/linebot-management/services`<br>`/api/bff/system/linebot-management/facilities`<br>`/api/bff/system/linebot-management/whitelist-snapshot`<br>`/api/bff/system/linebot-management/announcement-pipeline` | `400LINE service health snapshot`<br>`line_feature_whitelist` |
| `GET /api/bff/system/helper-status` | [[modules/helper-status|helper-status]] | implemented | `helperStatus`<br>`/api/bff/system/helper-status` | `external service catalog` |
| `GET /api/bff/system/line-whitelist` | [[modules/line-whitelist|line-whitelist]] | implemented | `lineWhitelist`<br>`/api/bff/system/line-whitelist`<br>`/api/bff/system/line-whitelist/candidates`<br>`/api/internal/line-whitelist/check`<br>`/api/cms/system/caution-permissions`<br>`/api/cms/system/caution-permissions/candidates`<br>`/api/cms/system/caution-permissions/check` | `line_feature_whitelist`<br>`caution_query_permissions`<br>`caution_query_permission_audit` |
| `GET /api/bff/system/line-whitelist/candidates` | [[modules/line-whitelist|line-whitelist]] | implemented | `lineWhitelist`<br>`/api/bff/system/line-whitelist`<br>`/api/bff/system/line-whitelist/candidates`<br>`/api/internal/line-whitelist/check`<br>`/api/cms/system/caution-permissions`<br>`/api/cms/system/caution-permissions/candidates`<br>`/api/cms/system/caution-permissions/check` | `line_feature_whitelist`<br>`caution_query_permissions`<br>`caution_query_permission_audit` |
| `GET /api/internal/line-whitelist/check` | [[modules/line-whitelist|line-whitelist]] | partial | `lineWhitelist`<br>`/api/bff/system/line-whitelist`<br>`/api/bff/system/line-whitelist/candidates`<br>`/api/internal/line-whitelist/check`<br>`/api/cms/system/caution-permissions`<br>`/api/cms/system/caution-permissions/candidates`<br>`/api/cms/system/caution-permissions/check` | `line_feature_whitelist`<br>`caution_query_permissions`<br>`caution_query_permission_audit` |
| `GET /api/cms/system/caution-permissions` | [[modules/line-whitelist|line-whitelist]] | implemented | `lineWhitelist`<br>`/api/bff/system/line-whitelist`<br>`/api/bff/system/line-whitelist/candidates`<br>`/api/internal/line-whitelist/check`<br>`/api/cms/system/caution-permissions`<br>`/api/cms/system/caution-permissions/candidates`<br>`/api/cms/system/caution-permissions/check` | `line_feature_whitelist`<br>`caution_query_permissions`<br>`caution_query_permission_audit` |
| `GET /api/cms/system/caution-permissions/candidates` | [[modules/line-whitelist|line-whitelist]] | implemented | `lineWhitelist`<br>`/api/bff/system/line-whitelist`<br>`/api/bff/system/line-whitelist/candidates`<br>`/api/internal/line-whitelist/check`<br>`/api/cms/system/caution-permissions`<br>`/api/cms/system/caution-permissions/candidates`<br>`/api/cms/system/caution-permissions/check` | `line_feature_whitelist`<br>`caution_query_permissions`<br>`caution_query_permission_audit` |
| `GET /api/cms/system/caution-permissions/check` | [[modules/line-whitelist|line-whitelist]] | implemented | `lineWhitelist`<br>`/api/bff/system/line-whitelist`<br>`/api/bff/system/line-whitelist/candidates`<br>`/api/internal/line-whitelist/check`<br>`/api/cms/system/caution-permissions`<br>`/api/cms/system/caution-permissions/candidates`<br>`/api/cms/system/caution-permissions/check` | `line_feature_whitelist`<br>`caution_query_permissions`<br>`caution_query_permission_audit` |
| `POST /api/bff/lifeguard/water-quality` | [[modules/lifeguard-water-quality|lifeguard-water-quality]] | partial | `/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/records` | `lifeguard_water_quality_logs` |
| `POST /api/bff/lifeguard/photo-upload` | [[modules/lifeguard-water-quality|lifeguard-water-quality]] | partial | `/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/records` | `lifeguard_water_quality_logs` |
| `POST /api/bff/lifeguard/coach-dive` | [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | partial | `/api/bff/lifeguard/home` | `lifeguard_coach_dive_logs` |
| `POST /api/bff/lifeguard/photo-upload` | [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | partial | `/api/bff/lifeguard/home` | `lifeguard_coach_dive_logs` |
| `POST /api/bff/lifeguard/cleanup` | [[modules/lifeguard-cleanup|lifeguard-cleanup]] | partial | `/api/bff/lifeguard/home` | `lifeguard_cleanup_logs` |
| `POST /api/bff/lifeguard/photo-upload` | [[modules/lifeguard-cleanup|lifeguard-cleanup]] | partial | `/api/bff/lifeguard/home` | `lifeguard_cleanup_logs` |
| `POST /api/bff/lifeguard/lane-issues` | [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | partial | `/api/bff/lifeguard/home` | `lifeguard_handover_notes` |
| `GET /api/bff/employee/lost-and-found` | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` | `lifeguard_lost_and_found` |
| `POST /api/bff/employee/lost-and-found` | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` | `lifeguard_lost_and_found` |
| `PATCH /api/bff/employee/lost-and-found/:id` | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` | `lifeguard_lost_and_found` |
| `GET /api/bff/lifeguard/lost-and-found` | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` | `lifeguard_lost_and_found` |
| `POST /api/bff/lifeguard/lost-and-found` | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` | `lifeguard_lost_and_found` |
| `PATCH /api/bff/lifeguard/lost-and-found/:id` | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` | `lifeguard_lost_and_found` |
| `GET /api/bff/lifeguard/lane-rentals` | [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | partial | `/api/bff/lifeguard/lane-rentals` | `lane_rentals` |
| `GET /api/bff/supervisor/lifeguard-overview` | [[modules/supervisor-lifeguard-overview|supervisor-lifeguard-overview]] | partial | `lifeguardOverview`<br>`/api/bff/supervisor/lifeguard-overview` | `lifeguard_water_quality_logs`<br>`lifeguard_coach_dive_logs`<br>`lifeguard_cleanup_logs`<br>`lifeguard_lost_and_found` |
| `GET /api/bff/system/ui-event-overview` | [[modules/analytics|analytics]] | partial | `reports`<br>`uiEventOverview`<br>`/api/bff/system/ui-event-overview` | `portal_events`<br>`ui_events` |
| `GET /api/bff/system/health-overview` | [[modules/system-health|system-health]] | implemented | `health`<br>`/api/bff/system/health-overview`<br>`/api/bff/system/integration-overview` | `integration_error_logs`<br>`sync_job_runs` |
| `GET /api/bff/system/integration-overview` | [[modules/system-health|system-health]] | implemented | `health`<br>`/api/bff/system/health-overview`<br>`/api/bff/system/integration-overview` | `integration_error_logs`<br>`sync_job_runs` |
| `GET /api/bff/system/overview` | [[modules/system-health|system-health]] | partial | `health`<br>`/api/bff/system/health-overview`<br>`/api/bff/system/integration-overview` | `integration_error_logs`<br>`sync_job_runs` |
| `GET /api/integrations/announcement-groups/messages` | [[modules/announcement-groups|announcement-groups]] | implemented | `announcements`<br>`announcementGroups`<br>`/api/bff/employee/home`<br>`/api/integrations/announcement-groups/messages` | `facility_announcement_groups` |
| `GET /api/bff/employee/handover/summary` | [[modules/handover|handover]] | implemented | `handover`<br>`handoverOverview` | `handover_entries`<br>`operational_handovers`<br>`portal_events` |
| `GET /api/bff/employee/handover/list` | [[modules/handover|handover]] | implemented | `handover`<br>`handoverOverview` | `handover_entries`<br>`operational_handovers`<br>`portal_events` |
| `GET /api/bff/employee/shifts/today` | [[modules/shift-reminder|shift-reminder]] | partial | `shifts`<br>`shifts`<br>`scheduleSnapshot`<br>`/api/bff/system/schedule-snapshot` | `source_snapshots` |
| `GET /api/bff/system/schedule-snapshot` | [[modules/shift-reminder|shift-reminder]] | partial | `shifts`<br>`shifts`<br>`scheduleSnapshot`<br>`/api/bff/system/schedule-snapshot` | `source_snapshots` |
| `GET /api/bff/employee/search` | [[modules/knowledge-base-qna|knowledge-base-qna]] | partial | `qna` | `knowledge_base_qna` |
| `GET /api/search/global` | [[modules/search|search]] | partial | `search`<br>`search`<br>`search` | `MODULE_REGISTRY` |
| `GET /api/bff/employee/home` | [[modules/portal-home|portal-home]] | partial | `home`<br>`/api/bff/employee/home` | `employee_home_projection` |
| `GET /api/bff/system/overview` | [[modules/system-observability|system-observability]] | partial | `observability`<br>`/api/bff/system/overview` | `system_overview_projection`<br>`integration_error_logs`<br>`bff_latency_logs` |
| `GET /api/bff/system/integration-overview` | [[modules/system-observability|system-observability]] | implemented | `observability`<br>`/api/bff/system/overview` | `system_overview_projection`<br>`integration_error_logs`<br>`bff_latency_logs` |
| `GET /api/bff/system/ui-event-overview` | [[modules/system-observability|system-observability]] | partial | `observability`<br>`/api/bff/system/overview` | `system_overview_projection`<br>`integration_error_logs`<br>`bff_latency_logs` |
| `GET /api/bff/system/ui-event-overview` | [[modules/telemetry-audit|telemetry-audit]] | partial | `audit`<br>`/api/bff/system/ui-event-overview` | `ui_events`<br>`audit_logs`<br>`portal_events`<br>`bff_latency_logs` |
| `GET /api/bff/system/line-bot/service-status` | [[modules/linebot-integration|linebot-integration]] | implemented | `/api/bff/employee/home`<br>`/api/bff/system/line-bot/service-status`<br>`/api/bff/system/line-bot/service-status/snapshots`<br>`/api/internal/service-health` | `source_snapshots` |
| `GET /api/bff/system/line-bot/service-status/snapshots` | [[modules/linebot-integration|linebot-integration]] | implemented | `/api/bff/employee/home`<br>`/api/bff/system/line-bot/service-status`<br>`/api/bff/system/line-bot/service-status/snapshots`<br>`/api/internal/service-health` | `source_snapshots` |
| `GET /api/internal/service-health` | [[modules/linebot-integration|linebot-integration]] | partial | `/api/bff/employee/home`<br>`/api/bff/system/line-bot/service-status`<br>`/api/bff/system/line-bot/service-status/snapshots`<br>`/api/internal/service-health` | `source_snapshots` |
| `GET /api/internal/service-health/snapshots` | [[modules/linebot-integration|linebot-integration]] | partial | `/api/bff/employee/home`<br>`/api/bff/system/line-bot/service-status`<br>`/api/bff/system/line-bot/service-status/snapshots`<br>`/api/internal/service-health` | `source_snapshots` |
| `GET /api/bff/system/schedule-snapshot` | [[modules/schedule-integration|schedule-integration]] | partial | `shifts`<br>`staffing`<br>`scheduleSnapshot`<br>`/api/bff/system/schedule-snapshot` | `source_snapshots`<br>`sync_job_runs` |
| `GET /api/bff/employee/home` | [[modules/employee-training|employee-training]] | partial | `training` | `employee_resources` |
| `GET /api/bff/system/watchdog-events` | [[modules/watchdog-events|watchdog-events]] | implemented | `watchdogEvents`<br>`/api/bff/system/watchdog-events` | `watchdog_events` |
| `GET /api/bff/employee/home` | [[modules/bff-projections|bff-projections]] | partial | `home`<br>`dashboard`<br>`overview` | `employee_home_projection`<br>`supervisor_dashboard_projection`<br>`system_overview_projection` |
| `GET /api/bff/supervisor/dashboard` | [[modules/bff-projections|bff-projections]] | partial | `home`<br>`dashboard`<br>`overview` | `employee_home_projection`<br>`supervisor_dashboard_projection`<br>`system_overview_projection` |
| `GET /api/bff/system/overview` | [[modules/bff-projections|bff-projections]] | partial | `home`<br>`dashboard`<br>`overview` | `employee_home_projection`<br>`supervisor_dashboard_projection`<br>`system_overview_projection` |
| `GET /api/bff/system/integration-overview` | [[modules/integration-sync-jobs|integration-sync-jobs]] | partial | `integrationOverview`<br>`/api/bff/system/integration-overview` | `integration_error_logs`<br>`sync_job_runs`<br>`source_snapshots` |

## Route To BFF Reference

| Route | Role | Module | Status | BFF Binding |
| --- | --- | --- | --- | --- |
| `/portal/login` | employee | [[modules/auth|auth]] | partial | `/api/auth/me` |
| `/login` | system | [[modules/auth|auth]] | partial | `/api/auth/me` |
| `/` | system | [[modules/dashboard|dashboard]] | implemented | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` |
| `/employee` | employee | [[modules/dashboard|dashboard]] | implemented | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` |
| `/employee/home` | employee | [[modules/dashboard|dashboard]] | implemented | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` |
| `/supervisor` | supervisor | [[modules/dashboard|dashboard]] | implemented | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` |
| `/supervisor/home` | supervisor | [[modules/dashboard|dashboard]] | implemented | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` |
| `/system` | system | [[modules/dashboard|dashboard]] | implemented | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` |
| `/system/overview` | system | [[modules/dashboard|dashboard]] | implemented | `home`<br>`dashboard`<br>`overview`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard`<br>`/api/bff/system/overview` |
| `/employee` | employee | [[modules/employee-home|employee-home]] | implemented | `home`<br>`/api/bff/employee/home` |
| `/employee/home` | employee | [[modules/employee-home|employee-home]] | implemented | `home`<br>`/api/bff/employee/home` |
| `/lifeguard` | lifeguard | [[modules/lifeguard-home|lifeguard-home]] | implemented | `lifeguardHome`<br>`/api/bff/lifeguard/home` |
| `/lifeguard/home` | lifeguard | [[modules/lifeguard-home|lifeguard-home]] | implemented | `lifeguardHome`<br>`/api/bff/lifeguard/home` |
| `/lifeguard/log` | lifeguard | [[modules/lifeguard-log|lifeguard-log]] | implemented | `lifeguardLog`<br>`lifeguardLog` |
| `/portal/:facilityKey/work-log` | employee | [[modules/lifeguard-log|lifeguard-log]] | partial | `lifeguardLog`<br>`lifeguardLog` |
| `/supervisor` | supervisor | [[modules/supervisor-dashboard|supervisor-dashboard]] | implemented | `dashboard`<br>`/api/bff/supervisor/dashboard` |
| `/supervisor/home` | supervisor | [[modules/supervisor-dashboard|supervisor-dashboard]] | implemented | `dashboard`<br>`/api/bff/supervisor/dashboard` |
| `/system` | system | [[modules/system-dashboard|system-dashboard]] | implemented | `overview`<br>`/api/bff/system/overview` |
| `/system/overview` | system | [[modules/system-dashboard|system-dashboard]] | implemented | `overview`<br>`/api/bff/system/overview` |
| `/system` | system | [[modules/system-control-center|system-control-center]] | implemented | `controlCenter`<br>`/api/bff/system/control-center` |
| `/system/watchdog` | system | [[modules/system-watchdog|system-watchdog]] | implemented | `watchdog`<br>`/api/bff/system/watchdog-events`<br>`/api/bff/system/integration-overview` |
| `/system/operations` | system | [[modules/system-operations|system-operations]] | implemented | `operations`<br>`/api/bff/system/operations/user-search`<br>`/api/bff/system/operations/user/:userId`<br>`/api/bff/system/operations/user/:userId/reset-session`<br>`/api/bff/system/operations/user/:userId/refresh-cache`<br>`/api/bff/system/operations/user/:userId/resend-notification`<br>`/api/bff/system/operations/recent-assists` |
| `/system/insights` | system | [[modules/system-insights|system-insights]] | implemented | `insights`<br>`/api/bff/system/insights/overview`<br>`/api/bff/system/insights/module/:moduleId` |
| `/system/governance` | system | [[modules/system-governance|system-governance]] | implemented | `governance`<br>`/api/modules/registry`<br>`/api/audit/logs` |
| `/system/linebot-management` | system | [[modules/linebot-management|linebot-management]] | implemented | `linebotManagement`<br>`/api/bff/system/linebot-management/overview`<br>`/api/bff/system/linebot-management/services`<br>`/api/bff/system/linebot-management/facilities`<br>`/api/bff/system/linebot-management/whitelist-snapshot`<br>`/api/bff/system/linebot-management/announcement-pipeline` |
| `/system/lineXBS-status` | system | [[modules/helper-status|helper-status]] | implemented | `helperStatus`<br>`/api/bff/system/helper-status` |
| `/system/helper-status` | system | [[modules/helper-status|helper-status]] | legacy | `helperStatus`<br>`/api/bff/system/helper-status` |
| `/system/line-whitelist` | system | [[modules/line-whitelist|line-whitelist]] | implemented | `lineWhitelist`<br>`/api/bff/system/line-whitelist`<br>`/api/bff/system/line-whitelist/candidates`<br>`/api/internal/line-whitelist/check`<br>`/api/cms/system/caution-permissions`<br>`/api/cms/system/caution-permissions/candidates`<br>`/api/cms/system/caution-permissions/check` |
| `/lifeguard/water-quality` | lifeguard | [[modules/lifeguard-water-quality|lifeguard-water-quality]] | partial | `/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/records` |
| `/lifeguard/water-quality-photo` | lifeguard | [[modules/lifeguard-water-quality|lifeguard-water-quality]] | legacy | `/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/records` |
| `/lifeguard/coach-dive` | lifeguard | [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | partial | `/api/bff/lifeguard/home` |
| `/lifeguard/coach-water-photo` | lifeguard | [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | legacy | `/api/bff/lifeguard/home` |
| `/lifeguard/cleanup` | lifeguard | [[modules/lifeguard-cleanup|lifeguard-cleanup]] | partial | `/api/bff/lifeguard/home` |
| `/lifeguard/closing-cleanup-photo` | lifeguard | [[modules/lifeguard-cleanup|lifeguard-cleanup]] | legacy | `/api/bff/lifeguard/home` |
| `/lifeguard/lane-issues` | lifeguard | [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | partial | `/api/bff/lifeguard/home` |
| `/lifeguard/lane-notes` | lifeguard | [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | legacy | `/api/bff/lifeguard/home` |
| `/lifeguard/lost-and-found` | lifeguard | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` |
| `/employee/lost-and-found` | employee | [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | partial | `/api/bff/employee/lost-and-found`<br>`/api/bff/lifeguard/home`<br>`/api/bff/lifeguard/lost-and-found` |
| `/lifeguard/lane-rentals` | lifeguard | [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | partial | `/api/bff/lifeguard/lane-rentals` |
| `/supervisor/lifeguard-overview` | supervisor | [[modules/supervisor-lifeguard-overview|supervisor-lifeguard-overview]] | partial | `lifeguardOverview`<br>`/api/bff/supervisor/lifeguard-overview` |
| `/system/function-relations` | system | [[modules/system-function-relations|system-function-relations]] | implemented | `functionRelations` |
| `/analytics` | system | [[modules/analytics|analytics]] | implemented | `reports`<br>`uiEventOverview`<br>`/api/bff/system/ui-event-overview` |
| `/supervisor/reports` | supervisor | [[modules/analytics|analytics]] | partial | `reports`<br>`uiEventOverview`<br>`/api/bff/system/ui-event-overview` |
| `/operations` | system | [[modules/operations|operations]] | legacy | `/api/bff/supervisor/dashboard` |
| `/supervisor/counter-log/submissions` | supervisor | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/supervisor/counter-log/daily-templates` | supervisor | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/supervisor/counter-log/assigned-tasks` | supervisor | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/supervisor/counter-log/recurring-templates` | supervisor | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/supervisor/counter-log/submissions` | system | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/admin/counter-logs/daily-templates` | system | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/admin/counter-logs/assigned-tasks` | system | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/admin/counter-logs/recurring-templates` | system | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/admin/counter-logs/submissions` | system | [[modules/counter-log|counter-log]] | partial | `counterLog` |
| `/supervisor/lane-rentals` | supervisor | [[modules/lane-rentals|lane-rentals]] | implemented | `laneRentals` |
| `/supervisor/lane-rentals` | system | [[modules/lane-rentals|lane-rentals]] | implemented | `laneRentals` |
| `/admin/lane-rentals` | system | [[modules/lane-rentals|lane-rentals]] | implemented | `laneRentals` |
| `/employee/courts/xinbei` | employee | [[modules/courts|courts]] | partial | `courts` |
| `/employee/courts/:school` | employee | [[modules/courts|courts]] | partial | `courts` |
| `/employee/courts/:school/week` | employee | [[modules/courts|courts]] | partial | `courts` |
| `/employee/courts/:school/month` | employee | [[modules/courts|courts]] | partial | `courts` |
| `/employee/courts/:school/search` | employee | [[modules/courts|courts]] | partial | `courts` |
| `/employee/courts/:school/admin` | employee | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/courts/xinbei` | supervisor | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/courts/:school` | supervisor | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/courts/:school/week` | supervisor | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/courts/:school/month` | supervisor | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/courts/:school/search` | supervisor | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/courts/:school/admin` | supervisor | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/courts/xinbei` | system | [[modules/courts|courts]] | partial | `courts` |
| `/courts/xinbei` | system | [[modules/courts|courts]] | partial | `courts` |
| `/courts/sanchong` | system | [[modules/courts|courts]] | partial | `courts` |
| `/supervisor/parking` | supervisor | [[modules/parking|parking]] | implemented | `parking` |
| `/supervisor/parking` | system | [[modules/parking|parking]] | implemented | `parking` |
| `/admin/parking/dashboard` | system | [[modules/parking|parking]] | implemented | `parking` |
| `/supervisor/parking/vehicles` | supervisor | [[modules/parking-vehicles|parking-vehicles]] | implemented | `parkingVehicles` |
| `/supervisor/parking/vehicles` | system | [[modules/parking-vehicles|parking-vehicles]] | implemented | `parkingVehicles` |
| `/admin/parking/vehicles` | system | [[modules/parking-vehicles|parking-vehicles]] | implemented | `parkingVehicles` |
| `/supervisor/parking/plans` | supervisor | [[modules/parking-plans|parking-plans]] | implemented | `parkingPlans` |
| `/supervisor/parking/plans` | system | [[modules/parking-plans|parking-plans]] | implemented | `parkingPlans` |
| `/admin/parking/plans` | system | [[modules/parking-plans|parking-plans]] | implemented | `parkingPlans` |
| `/supervisor/parking/contracts` | supervisor | [[modules/parking-contracts|parking-contracts]] | implemented | `parkingContracts` |
| `/supervisor/parking/contracts` | system | [[modules/parking-contracts|parking-contracts]] | implemented | `parkingContracts` |
| `/admin/parking/contracts` | system | [[modules/parking-contracts|parking-contracts]] | implemented | `parkingContracts` |
| `/parking/sign/:token` | - | [[modules/parking-contracts|parking-contracts]] | implemented | `parkingContracts` |
| `/supervisor/parking/payments` | supervisor | [[modules/parking-payments|parking-payments]] | implemented | `parkingPayments` |
| `/supervisor/parking/payments` | system | [[modules/parking-payments|parking-payments]] | implemented | `parkingPayments` |
| `/admin/parking/payments` | system | [[modules/parking-payments|parking-payments]] | implemented | `parkingPayments` |
| `/supervisor/parking/event-days` | supervisor | [[modules/parking-event-days|parking-event-days]] | implemented | `parkingEventDays` |
| `/supervisor/parking/event-days` | system | [[modules/parking-event-days|parking-event-days]] | implemented | `parkingEventDays` |
| `/admin/parking/event-days` | system | [[modules/parking-event-days|parking-event-days]] | implemented | `parkingEventDays` |
| `/hr-audit` | system | [[modules/hr-audit|hr-audit]] | partial | `audit`<br>`/api/hr-audit` |
| `/system-health` | system | [[modules/system-health|system-health]] | implemented | `health`<br>`/api/bff/system/health-overview`<br>`/api/bff/system/integration-overview` |
| `/system/health` | system | [[modules/system-health|system-health]] | implemented | `health`<br>`/api/bff/system/health-overview`<br>`/api/bff/system/integration-overview` |
| `/system/integrations` | system | [[modules/system-health|system-health]] | implemented | `health`<br>`/api/bff/system/health-overview`<br>`/api/bff/system/integration-overview` |
| `/portal/:facilityKey/announcements` | employee | [[modules/announcements|announcements]] | legacy | `announcements`<br>`announcementAcks`<br>`/api/bff/employee/home` |
| `/portal/:facilityKey/announcements/:id` | employee | [[modules/announcements|announcements]] | legacy | `announcements`<br>`announcementAcks`<br>`/api/bff/employee/home` |
| `/employee/announcements` | employee | [[modules/announcements|announcements]] | implemented | `announcements`<br>`announcementAcks`<br>`/api/bff/employee/home` |
| `/supervisor/announcements` | supervisor | [[modules/announcements|announcements]] | implemented | `announcements`<br>`announcementAcks`<br>`/api/bff/employee/home` |
| `/supervisor/announcement-groups` | supervisor | [[modules/announcement-groups|announcement-groups]] | implemented | `announcements`<br>`announcementGroups`<br>`/api/bff/employee/home`<br>`/api/integrations/announcement-groups/messages` |
| `/admin/announcement-groups` | system | [[modules/announcement-groups|announcement-groups]] | legacy | `announcements`<br>`announcementGroups`<br>`/api/bff/employee/home`<br>`/api/integrations/announcement-groups/messages` |
| `/announcements` | system | [[modules/announcement-review|announcement-review]] | implemented | `announcementReview`<br>`/api/announcement-candidates` |
| `/portal/:facilityKey/review` | employee | [[modules/announcement-review|announcement-review]] | partial | `announcementReview`<br>`/api/announcement-candidates` |
| `/supervisor/announcements` | supervisor | [[modules/announcement-review|announcement-review]] | implemented | `announcementReview`<br>`/api/announcement-candidates` |
| `/announcements/summary` | system | [[modules/announcement-summary|announcement-summary]] | implemented | `announcementSummary`<br>`/api/announcement-dashboard/summary` |
| `/portal/:facilityKey/manage` | employee | [[modules/system-announcements|system-announcements]] | partial | `announcements`<br>`announcements` |
| `/supervisor/announcements` | supervisor | [[modules/system-announcements|system-announcements]] | implemented | `announcements`<br>`announcements` |
| `/employee/tasks` | employee | [[modules/tasks|tasks]] | implemented | `tasks`<br>`incompleteTasks`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard` |
| `/supervisor/tasks` | supervisor | [[modules/tasks|tasks]] | implemented | `tasks`<br>`incompleteTasks`<br>`/api/bff/employee/home`<br>`/api/bff/supervisor/dashboard` |
| `/portal/:facilityKey/handover` | employee | [[modules/handover|handover]] | legacy | `handover`<br>`handoverOverview` |
| `/employee/handover` | employee | [[modules/handover|handover]] | implemented | `handover`<br>`handoverOverview` |
| `/supervisor/handover` | supervisor | [[modules/handover|handover]] | implemented | `handover`<br>`handoverOverview` |
| `/anomaly-reports` | system | [[modules/anomalies|anomalies]] | implemented | `pendingAnomalies`<br>`alerts` |
| `/supervisor/anomalies` | supervisor | [[modules/anomalies|anomalies]] | implemented | `pendingAnomalies`<br>`alerts` |
| `/system/alerts` | system | [[modules/anomalies|anomalies]] | implemented | `pendingAnomalies`<br>`alerts` |
| `/anomaly-reports` | system | [[modules/notification-recipients|notification-recipients]] | partial | `/api/notification-recipients` |
| `/portal/:facilityKey/campaigns` | employee | [[modules/campaigns-events|campaigns-events]] | legacy | `campaigns` |
| `/employee/announcements` | employee | [[modules/campaigns-events|campaigns-events]] | partial | `campaigns` |
| `/portal/:facilityKey/shift` | employee | [[modules/shift-reminder|shift-reminder]] | legacy | `shifts`<br>`shifts`<br>`scheduleSnapshot`<br>`/api/bff/system/schedule-snapshot` |
| `/employee/shift` | employee | [[modules/shift-reminder|shift-reminder]] | implemented | `shifts`<br>`shifts`<br>`scheduleSnapshot`<br>`/api/bff/system/schedule-snapshot` |
| `/portal/:facilityKey/manage` | employee | [[modules/quick-links|quick-links]] | legacy | `shortcuts` |
| `/employee/more` | employee | [[modules/quick-links|quick-links]] | partial | `shortcuts` |
| `/employee/qna` | employee | [[modules/knowledge-base-qna|knowledge-base-qna]] | partial | `qna` |
| `/supervisor/qna-review` | supervisor | [[modules/knowledge-base-qna|knowledge-base-qna]] | partial | `qna` |
| `/employee/personal-note` | employee | [[modules/personal-note|personal-note]] | partial | `stickyNotes` |
| `/employee/more` | employee | [[modules/personal-note|personal-note]] | partial | `stickyNotes` |
| `/employee/activity-periods` | employee | [[modules/activity-periods|activity-periods]] | partial | `events` |
| `/employee/activity-periods/:id` | employee | [[modules/activity-periods|activity-periods]] | partial | `events` |
| `/portal/:facilityKey/campaigns` | employee | [[modules/activity-periods|activity-periods]] | partial | `events` |
| `/employee/registration-courses` | employee | [[modules/registration-courses|registration-courses]] | partial | `registrationCourses` |
| `/employee/checkins` | employee | [[modules/checkins|checkins]] | partial | `checkins` |
| `/employee/settings` | employee | [[modules/employee-settings|employee-settings]] | partial | `settings` |
| `/supervisor/facilities` | supervisor | [[modules/search|search]] | partial | `search`<br>`search`<br>`search` |
| `/supervisor/facilities/:facilityKey` | supervisor | [[modules/search|search]] | partial | `search`<br>`search`<br>`search` |
| `/supervisor/people` | supervisor | [[modules/search|search]] | partial | `search`<br>`search`<br>`search` |
| `/portal` | employee | [[modules/portal-home|portal-home]] | legacy | `home`<br>`/api/bff/employee/home` |
| `/portal/:facilityKey` | employee | [[modules/portal-home|portal-home]] | legacy | `home`<br>`/api/bff/employee/home` |
| `/portal/:facilityKey/manage` | employee | [[modules/portal-manage|portal-manage]] | partial | - |
| `/portal/:facilityKey/review` | employee | [[modules/portal-review|portal-review]] | partial | `announcementReview` |
| `/portal/:facilityKey/analytics` | employee | [[modules/portal-analytics|portal-analytics]] | legacy | `portalAnalytics`<br>`portalAnalytics` |
| `/system/audit` | system | [[modules/portal-analytics|portal-analytics]] | partial | `portalAnalytics`<br>`portalAnalytics` |
| `/system` | system | [[modules/system-observability|system-observability]] | implemented | `observability`<br>`/api/bff/system/overview` |
| `/system/integrations` | system | [[modules/system-observability|system-observability]] | implemented | `observability`<br>`/api/bff/system/overview` |
| `/system/audit` | system | [[modules/system-observability|system-observability]] | implemented | `observability`<br>`/api/bff/system/overview` |
| `/system/audit` | system | [[modules/telemetry-audit|telemetry-audit]] | partial | `audit`<br>`/api/bff/system/ui-event-overview` |
| `/employee/documents` | employee | [[modules/employee-resources|employee-resources]] | partial | `documents`<br>`settings` |
| `/employee/more` | employee | [[modules/employee-resources|employee-resources]] | partial | `documents`<br>`settings` |
| `/portal/:facilityKey/manage` | employee | [[modules/employee-resources|employee-resources]] | partial | `documents`<br>`settings` |
| `/employee/training` | employee | [[modules/employee-training|employee-training]] | partial | `training` |
| `/supervisor/training` | supervisor | [[modules/employee-training|employee-training]] | partial | `training` |
| `/system/training-views` | system | [[modules/employee-training|employee-training]] | partial | `training` |
| `/system/alerts` | system | [[modules/watchdog-events|watchdog-events]] | partial | `watchdogEvents`<br>`/api/bff/system/watchdog-events` |
| `/system/integrations` | system | [[modules/integration-sync-jobs|integration-sync-jobs]] | partial | `integrationOverview`<br>`/api/bff/system/integration-overview` |
