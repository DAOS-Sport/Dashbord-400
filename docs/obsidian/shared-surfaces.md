# Shared Surfaces

[[00-index|模組總覽]] / [[bff-reference-map|BFF Reference Map]] / [[bff-technical-spec|BFF 技術規範]] / [[cleanup-backlog|清洗 backlog]]

## Stable Shared Blocks

- Module registry: `shared/modules/registry.ts`
- Workbench route manifest: `shared/navigation/workbench-routes.ts`
- Module descriptors and navigation DTOs: `shared/modules/descriptors.ts`
- Shared UI state components: `client/src/design-system/components/EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`, `DegradedState.tsx`, `FreshnessIndicator.tsx`
- Shared visual units for DTO reuse: `AnnouncementCard.tsx`, `TaskRow.tsx`, `DenseRow.tsx`
- BFF route layer: `server/modules/bff/*`
- System governance UI: `client/src/modules/system/governance/page.tsx`
- System helper status BFF owner: `server/modules/system/helper-status-routes.ts`
- 400LINE management BFF owner: `server/modules/system/linebot-management-routes.ts`
- System operations BFF owner: `server/modules/system/operations-routes.ts`
- Authenticated BFF smoke template: `scripts/authenticated-bff-smoke.ts`
- LINE whitelist contract/UI/BFF: `shared/system/line-whitelist-contract.ts`, `client/src/modules/system/line-whitelist/*`, `server/modules/system/line-whitelist-routes.ts`, `server/modules/system/caution-permissions-routes.ts`, `server/modules/system/line-bot-routes.ts`, and `server/modules/system/line-whitelist-service.ts`
- Schema and persistence: `shared/schema.ts`, `server/storage.ts`

## Integration Provider Counts

| Provider | Registered Uses |
| --- | --- |
| POSTGRES | 42 |
| LINE_BOT_ASSISTANT | 16 |
| UNKNOWN | 13 |
| OBJECT_STORAGE | 10 |
| RAGIC | 9 |
| SMART_SCHEDULE_MANAGER | 8 |
| GMAIL_SMTP | 5 |
| LOCAL_STORAGE | 1 |
| NEON | 1 |
| CWA | 1 |

## Shared Tables / Entities

| Table / Entity | Module Owners |
| --- | --- |
| audit_logs | [[modules/system-control-center|system-control-center]], [[modules/system-operations|system-operations]], [[modules/system-insights|system-insights]], [[modules/system-governance|system-governance]], [[modules/announcement-review|announcement-review]], [[modules/anomalies|anomalies]], [[modules/portal-review|portal-review]], [[modules/telemetry-audit|telemetry-audit]] |
| employee_resources | [[modules/employee-home|employee-home]], [[modules/campaigns-events|campaigns-events]], [[modules/activity-periods|activity-periods]], [[modules/portal-manage|portal-manage]], [[modules/employee-resources|employee-resources]], [[modules/employee-training|employee-training]] |
| source_snapshots | [[modules/operations|operations]], [[modules/announcement-summary|announcement-summary]], [[modules/shift-reminder|shift-reminder]], [[modules/linebot-integration|linebot-integration]], [[modules/schedule-integration|schedule-integration]], [[modules/integration-sync-jobs|integration-sync-jobs]] |
| employee_home_projection | [[modules/dashboard|dashboard]], [[modules/employee-home|employee-home]], [[modules/portal-home|portal-home]], [[modules/bff-projections|bff-projections]] |
| system_overview_projection | [[modules/dashboard|dashboard]], [[modules/system-dashboard|system-dashboard]], [[modules/system-observability|system-observability]], [[modules/bff-projections|bff-projections]] |
| integration_error_logs | [[modules/system-watchdog|system-watchdog]], [[modules/system-health|system-health]], [[modules/system-observability|system-observability]], [[modules/integration-sync-jobs|integration-sync-jobs]] |
| user_role_snapshots | [[modules/hr-audit|hr-audit]], [[modules/ragic-integration|ragic-integration]], [[modules/session-governance|session-governance]], [[modules/user-role-snapshots|user-role-snapshots]] |
| portal_events | [[modules/announcements|announcements]], [[modules/handover|handover]], [[modules/portal-analytics|portal-analytics]], [[modules/telemetry-audit|telemetry-audit]] |
| users | [[modules/auth|auth]], [[modules/system-operations|system-operations]], [[modules/legacy-users|legacy-users]] |
| sessions_index | [[modules/auth|auth]], [[modules/system-operations|system-operations]], [[modules/session-governance|session-governance]] |
| supervisor_dashboard_projection | [[modules/dashboard|dashboard]], [[modules/supervisor-dashboard|supervisor-dashboard]], [[modules/bff-projections|bff-projections]] |
| watchdog_events | [[modules/system-control-center|system-control-center]], [[modules/system-watchdog|system-watchdog]], [[modules/watchdog-events|watchdog-events]] |
| sync_job_runs | [[modules/system-health|system-health]], [[modules/schedule-integration|schedule-integration]], [[modules/integration-sync-jobs|integration-sync-jobs]] |
| system_announcements | [[modules/announcements|announcements]], [[modules/system-announcements|system-announcements]], [[modules/portal-manage|portal-manage]] |
| quick_links | [[modules/quick-links|quick-links]], [[modules/employee-settings|employee-settings]], [[modules/portal-manage|portal-manage]] |
| auth_audit_logs | [[modules/auth|auth]], [[modules/hr-audit|hr-audit]] |
| operational_handovers | [[modules/employee-home|employee-home]], [[modules/handover|handover]] |
| daily_report_submissions | [[modules/lifeguard-home|lifeguard-home]], [[modules/lifeguard-log|lifeguard-log]] |
| lifeguard_handover_notes | [[modules/lifeguard-log|lifeguard-log]], [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] |
| ui_events | [[modules/system-insights|system-insights]], [[modules/telemetry-audit|telemetry-audit]] |
| line_feature_whitelist | [[modules/linebot-management|linebot-management]], [[modules/line-whitelist|line-whitelist]] |
| lane_rentals | [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]], [[modules/lane-rentals|lane-rentals]] |
| lane_rental_layouts | [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]], [[modules/lane-rentals|lane-rentals]] |
| MODULE_REGISTRY | [[modules/system-function-relations|system-function-relations]], [[modules/search|search]] |
| parking_vehicles | [[modules/parking|parking]], [[modules/parking-vehicles|parking-vehicles]] |
| parking_contracts | [[modules/parking|parking]], [[modules/parking-contracts|parking-contracts]] |
| parking_payments | [[modules/parking|parking]], [[modules/parking-payments|parking-payments]] |
| parking_event_days | [[modules/parking|parking]], [[modules/parking-event-days|parking-event-days]] |
| notification_recipients | [[modules/notification-recipients|notification-recipients]], [[modules/gmail-integration|gmail-integration]] |
| widget_layout_settings | [[modules/employee-settings|employee-settings]], [[modules/widget-layout-settings|widget-layout-settings]] |
| bff_latency_logs | [[modules/system-observability|system-observability]], [[modules/telemetry-audit|telemetry-audit]] |

## Shared API Paths

| API | Module Owners |
| --- | --- |
| GET /api/bff/employee/home | [[modules/dashboard|dashboard]], [[modules/employee-home|employee-home]], [[modules/portal-home|portal-home]], [[modules/employee-training|employee-training]], [[modules/bff-projections|bff-projections]] |
| GET /api/bff/system/overview | [[modules/dashboard|dashboard]], [[modules/system-dashboard|system-dashboard]], [[modules/system-health|system-health]], [[modules/system-observability|system-observability]], [[modules/bff-projections|bff-projections]] |
| GET /api/portal/employee-resources | [[modules/campaigns-events|campaigns-events]], [[modules/activity-periods|activity-periods]], [[modules/portal-manage|portal-manage]], [[modules/employee-resources|employee-resources]], [[modules/employee-training|employee-training]] |
| GET /api/bff/system/integration-overview | [[modules/system-watchdog|system-watchdog]], [[modules/system-health|system-health]], [[modules/system-observability|system-observability]], [[modules/integration-sync-jobs|integration-sync-jobs]] |
| GET /api/auth/me | [[modules/auth|auth]], [[modules/session-governance|session-governance]], [[modules/user-role-snapshots|user-role-snapshots]] |
| POST /api/auth/active-facility | [[modules/auth|auth]], [[modules/facilities|facilities]], [[modules/session-governance|session-governance]] |
| GET /api/bff/supervisor/dashboard | [[modules/dashboard|dashboard]], [[modules/supervisor-dashboard|supervisor-dashboard]], [[modules/bff-projections|bff-projections]] |
| GET /api/admin/overview | [[modules/dashboard|dashboard]], [[modules/operations|operations]], [[modules/schedule-integration|schedule-integration]] |
| POST /api/bff/lifeguard/photo-upload | [[modules/lifeguard-water-quality|lifeguard-water-quality]], [[modules/lifeguard-coach-dive|lifeguard-coach-dive]], [[modules/lifeguard-cleanup|lifeguard-cleanup]] |
| GET /api/portal/system-announcements | [[modules/announcements|announcements]], [[modules/system-announcements|system-announcements]], [[modules/portal-manage|portal-manage]] |
| GET /api/announcement-candidates | [[modules/announcement-review|announcement-review]], [[modules/portal-review|portal-review]], [[modules/linebot-integration|linebot-integration]] |
| POST /api/announcement-candidates/:id/approve | [[modules/announcement-review|announcement-review]], [[modules/portal-review|portal-review]], [[modules/linebot-integration|linebot-integration]] |
| POST /api/announcement-candidates/:id/reject | [[modules/announcement-review|announcement-review]], [[modules/portal-review|portal-review]], [[modules/linebot-integration|linebot-integration]] |
| POST /api/portal/employee-resources | [[modules/campaigns-events|campaigns-events]], [[modules/employee-resources|employee-resources]], [[modules/employee-training|employee-training]] |
| GET /api/portal/quick-links | [[modules/quick-links|quick-links]], [[modules/employee-settings|employee-settings]], [[modules/portal-manage|portal-manage]] |
| PATCH /api/portal/layout-settings | [[modules/employee-settings|employee-settings]], [[modules/portal-manage|portal-manage]], [[modules/widget-layout-settings|widget-layout-settings]] |
| POST /api/auth/login | [[modules/auth|auth]], [[modules/legacy-users|legacy-users]] |
| POST /api/auth/active-role | [[modules/auth|auth]], [[modules/session-governance|session-governance]] |
| POST /api/auth/ragic-login | [[modules/auth|auth]], [[modules/ragic-integration|ragic-integration]] |
| GET /api/bff/lifeguard/home | [[modules/lifeguard-home|lifeguard-home]], [[modules/lifeguard-log|lifeguard-log]] |
| GET /api/bff/system/watchdog-events | [[modules/system-watchdog|system-watchdog]], [[modules/watchdog-events|watchdog-events]] |
| GET /api/admin/interview-users | [[modules/hr-audit|hr-audit]], [[modules/schedule-integration|schedule-integration]] |
| GET /api/bff/system/health-overview | [[modules/system-health|system-health]], [[modules/ragic-integration|ragic-integration]] |
| GET /api/facility-home/:groupId/announcements | [[modules/announcements|announcements]], [[modules/linebot-integration|linebot-integration]] |
| GET /api/facility-home/:groupId/announcements/:id | [[modules/announcements|announcements]], [[modules/linebot-integration|linebot-integration]] |
| POST /api/facility-home/:groupId/announcements/:id/ack | [[modules/announcements|announcements]], [[modules/linebot-integration|linebot-integration]] |
| POST /api/portal/system-announcements | [[modules/announcements|announcements]], [[modules/system-announcements|system-announcements]] |
| PATCH /api/portal/system-announcements/:id | [[modules/announcements|announcements]], [[modules/system-announcements|system-announcements]] |
| DELETE /api/portal/system-announcements/:id | [[modules/announcements|announcements]], [[modules/system-announcements|system-announcements]] |
| GET /api/announcement-candidates/:id | [[modules/announcement-review|announcement-review]], [[modules/linebot-integration|linebot-integration]] |
| GET /api/announcement-dashboard/summary | [[modules/announcement-summary|announcement-summary]], [[modules/linebot-integration|linebot-integration]] |
| GET /api/announcement-reports/weekly | [[modules/announcement-summary|announcement-summary]], [[modules/linebot-integration|linebot-integration]] |
| GET /api/facility-home/:groupId/handover | [[modules/handover|handover]], [[modules/linebot-integration|linebot-integration]] |
| POST /api/anomaly-report | [[modules/anomalies|anomalies]], [[modules/file-upload-export|file-upload-export]] |
| GET /api/facility-home/:groupId/today-shift | [[modules/shift-reminder|shift-reminder]], [[modules/linebot-integration|linebot-integration]] |
| GET /api/bff/system/schedule-snapshot | [[modules/shift-reminder|shift-reminder]], [[modules/schedule-integration|schedule-integration]] |
| GET /api/facility-home/:groupId/home | [[modules/portal-home|portal-home]], [[modules/linebot-integration|linebot-integration]] |
| GET /api/portal/layout-settings | [[modules/portal-manage|portal-manage]], [[modules/widget-layout-settings|widget-layout-settings]] |
| GET /api/portal/analytics | [[modules/portal-analytics|portal-analytics]], [[modules/telemetry-audit|telemetry-audit]] |
| POST /api/portal/events | [[modules/portal-analytics|portal-analytics]], [[modules/telemetry-audit|telemetry-audit]] |
| GET /api/bff/system/ui-event-overview | [[modules/system-observability|system-observability]], [[modules/telemetry-audit|telemetry-audit]] |
| PATCH /api/portal/employee-resources/:id | [[modules/employee-resources|employee-resources]], [[modules/employee-training|employee-training]] |
| DELETE /api/portal/employee-resources/:id | [[modules/employee-resources|employee-resources]], [[modules/employee-training|employee-training]] |

## BFF Sections And Endpoints

| Module | Surface | Binding |
| --- | --- | --- |
| [[modules/auth|auth]] | system | auth |
| [[modules/auth|auth]] | endpoint | /api/auth/me |
| [[modules/dashboard|dashboard]] | employee | home |
| [[modules/dashboard|dashboard]] | supervisor | dashboard |
| [[modules/dashboard|dashboard]] | system | overview |
| [[modules/dashboard|dashboard]] | endpoint | /api/bff/employee/home |
| [[modules/dashboard|dashboard]] | endpoint | /api/bff/supervisor/dashboard |
| [[modules/dashboard|dashboard]] | endpoint | /api/bff/system/overview |
| [[modules/employee-home|employee-home]] | employee | home |
| [[modules/employee-home|employee-home]] | endpoint | /api/bff/employee/home |
| [[modules/lifeguard-home|lifeguard-home]] | employee | lifeguardHome |
| [[modules/lifeguard-home|lifeguard-home]] | endpoint | /api/bff/lifeguard/home |
| [[modules/lifeguard-log|lifeguard-log]] | employee | lifeguardLog |
| [[modules/lifeguard-log|lifeguard-log]] | supervisor | lifeguardLog |
| [[modules/supervisor-dashboard|supervisor-dashboard]] | supervisor | dashboard |
| [[modules/supervisor-dashboard|supervisor-dashboard]] | endpoint | /api/bff/supervisor/dashboard |
| [[modules/system-dashboard|system-dashboard]] | system | overview |
| [[modules/system-dashboard|system-dashboard]] | endpoint | /api/bff/system/overview |
| [[modules/system-control-center|system-control-center]] | system | controlCenter |
| [[modules/system-control-center|system-control-center]] | endpoint | /api/bff/system/control-center |
| [[modules/system-watchdog|system-watchdog]] | system | watchdog |
| [[modules/system-watchdog|system-watchdog]] | endpoint | /api/bff/system/watchdog-events |
| [[modules/system-watchdog|system-watchdog]] | endpoint | /api/bff/system/integration-overview |
| [[modules/system-operations|system-operations]] | system | operations |
| [[modules/system-operations|system-operations]] | endpoint | /api/bff/system/operations/user-search |
| [[modules/system-operations|system-operations]] | endpoint | /api/bff/system/operations/user/:userId |
| [[modules/system-operations|system-operations]] | endpoint | /api/bff/system/operations/user/:userId/reset-session |
| [[modules/system-operations|system-operations]] | endpoint | /api/bff/system/operations/user/:userId/refresh-cache |
| [[modules/system-operations|system-operations]] | endpoint | /api/bff/system/operations/user/:userId/resend-notification |
| [[modules/system-operations|system-operations]] | endpoint | /api/bff/system/operations/recent-assists |
| [[modules/system-insights|system-insights]] | system | insights |
| [[modules/system-insights|system-insights]] | endpoint | /api/bff/system/insights/overview |
| [[modules/system-insights|system-insights]] | endpoint | /api/bff/system/insights/module/:moduleId |
| [[modules/system-governance|system-governance]] | system | governance |
| [[modules/system-governance|system-governance]] | endpoint | /api/modules/registry |
| [[modules/system-governance|system-governance]] | endpoint | /api/audit/logs |
| [[modules/linebot-management|linebot-management]] | system | linebotManagement |
| [[modules/linebot-management|linebot-management]] | endpoint | /api/bff/system/linebot-management/overview |
| [[modules/linebot-management|linebot-management]] | endpoint | /api/bff/system/linebot-management/services |
| [[modules/linebot-management|linebot-management]] | endpoint | /api/bff/system/linebot-management/facilities |
| [[modules/linebot-management|linebot-management]] | endpoint | /api/bff/system/linebot-management/whitelist-snapshot |
| [[modules/linebot-management|linebot-management]] | endpoint | /api/bff/system/linebot-management/announcement-pipeline |
| [[modules/helper-status|helper-status]] | system | helperStatus |
| [[modules/helper-status|helper-status]] | endpoint | /api/bff/system/helper-status |
| [[modules/line-whitelist|line-whitelist]] | system | lineWhitelist |
| [[modules/line-whitelist|line-whitelist]] | endpoint | /api/bff/system/line-whitelist |
| [[modules/line-whitelist|line-whitelist]] | endpoint | /api/bff/system/line-whitelist/candidates |
| [[modules/line-whitelist|line-whitelist]] | endpoint | /api/internal/line-whitelist/check |
| [[modules/line-whitelist|line-whitelist]] | endpoint | /api/cms/system/caution-permissions |
| [[modules/line-whitelist|line-whitelist]] | endpoint | /api/cms/system/caution-permissions/candidates |
| [[modules/line-whitelist|line-whitelist]] | endpoint | /api/cms/system/caution-permissions/check |
| [[modules/lifeguard-water-quality|lifeguard-water-quality]] | endpoint | /api/bff/lifeguard/home |
| [[modules/lifeguard-water-quality|lifeguard-water-quality]] | endpoint | /api/bff/lifeguard/records |
| [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | endpoint | /api/bff/lifeguard/home |
| [[modules/lifeguard-cleanup|lifeguard-cleanup]] | endpoint | /api/bff/lifeguard/home |
| [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | endpoint | /api/bff/lifeguard/home |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | endpoint | /api/bff/employee/lost-and-found |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | endpoint | /api/bff/lifeguard/home |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | endpoint | /api/bff/lifeguard/lost-and-found |
| [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | endpoint | /api/bff/lifeguard/lane-rentals |
| [[modules/system-function-relations|system-function-relations]] | system | functionRelations |
| [[modules/operations|operations]] | supervisor | legacyOperations |
| [[modules/operations|operations]] | endpoint | /api/bff/supervisor/dashboard |
| [[modules/lane-rentals|lane-rentals]] | supervisor | laneRentals |
| [[modules/courts|courts]] | employee | courts |
| [[modules/courts|courts]] | supervisor | courts |
| [[modules/courts|courts]] | endpoint | /api/courts/xinbei/stats |
| [[modules/parking|parking]] | supervisor | parking |
| [[modules/parking-vehicles|parking-vehicles]] | supervisor | parkingVehicles |
| [[modules/parking-plans|parking-plans]] | supervisor | parkingPlans |
| [[modules/parking-contracts|parking-contracts]] | supervisor | parkingContracts |
| [[modules/parking-payments|parking-payments]] | supervisor | parkingPayments |
| [[modules/parking-event-days|parking-event-days]] | supervisor | parkingEventDays |
| [[modules/hr-audit|hr-audit]] | system | audit |
| [[modules/hr-audit|hr-audit]] | endpoint | /api/hr-audit |
| [[modules/system-health|system-health]] | system | health |
| [[modules/system-health|system-health]] | endpoint | /api/bff/system/health-overview |
| [[modules/system-health|system-health]] | endpoint | /api/bff/system/integration-overview |
| [[modules/announcements|announcements]] | employee | announcements |
| [[modules/announcements|announcements]] | supervisor | announcementAcks |
| [[modules/announcements|announcements]] | endpoint | /api/bff/employee/home |
| [[modules/announcement-groups|announcement-groups]] | employee | announcements |
| [[modules/announcement-groups|announcement-groups]] | supervisor | announcementGroups |
| [[modules/announcement-groups|announcement-groups]] | endpoint | /api/bff/employee/home |
| [[modules/announcement-groups|announcement-groups]] | endpoint | /api/integrations/announcement-groups/messages |
| [[modules/announcement-review|announcement-review]] | supervisor | announcementReview |
| [[modules/announcement-review|announcement-review]] | endpoint | /api/announcement-candidates |
| [[modules/announcement-summary|announcement-summary]] | supervisor | announcementSummary |
| [[modules/announcement-summary|announcement-summary]] | endpoint | /api/announcement-dashboard/summary |
| [[modules/system-announcements|system-announcements]] | employee | announcements |
| [[modules/system-announcements|system-announcements]] | supervisor | announcements |
| [[modules/handover|handover]] | employee | handover |
| [[modules/handover|handover]] | supervisor | handoverOverview |
| [[modules/handover|handover]] | endpoint | /api/bff/employee/handover/list |
| [[modules/handover|handover]] | endpoint | /api/bff/employee/handover/summary |
| [[modules/handover|handover]] | endpoint | /api/bff/supervisor/dashboard |
| [[modules/anomalies|anomalies]] | supervisor | pendingAnomalies |
| [[modules/anomalies|anomalies]] | system | alerts |
| [[modules/notification-recipients|notification-recipients]] | system | notificationRecipients |
| [[modules/notification-recipients|notification-recipients]] | endpoint | /api/notification-recipients |
| [[modules/campaigns-events|campaigns-events]] | employee | campaigns |
| [[modules/booking-snapshot|booking-snapshot]] | employee | bookingSnapshot |
| [[modules/booking-snapshot|booking-snapshot]] | endpoint | /api/bff/employee/home |
| [[modules/shift-reminder|shift-reminder]] | employee | shifts |
| [[modules/shift-reminder|shift-reminder]] | supervisor | shifts |
| [[modules/shift-reminder|shift-reminder]] | system | scheduleSnapshot |
| [[modules/shift-reminder|shift-reminder]] | endpoint | /api/bff/system/schedule-snapshot |
| [[modules/quick-links|quick-links]] | employee | shortcuts |
| [[modules/notification-center|notification-center]] | employee | notifications |
| [[modules/notification-center|notification-center]] | supervisor | notifications |
| [[modules/notification-center|notification-center]] | system | notifications |
| [[modules/knowledge-base-qna|knowledge-base-qna]] | employee | qna |
| [[modules/activity-periods|activity-periods]] | employee | events |
| [[modules/registration-courses|registration-courses]] | employee | registrationCourses |
| [[modules/employee-settings|employee-settings]] | employee | settings |
| [[modules/search|search]] | employee | search |
| [[modules/search|search]] | supervisor | search |
| [[modules/search|search]] | system | search |
| [[modules/weather-widget|weather-widget]] | employee | weather |
| [[modules/group-broadcasts|group-broadcasts]] | employee | announcements |
| [[modules/group-broadcasts|group-broadcasts]] | supervisor | groupBroadcasts |
| [[modules/portal-home|portal-home]] | employee | home |
| [[modules/portal-home|portal-home]] | endpoint | /api/bff/employee/home |
| [[modules/portal-manage|portal-manage]] | supervisor | portalManage |
| [[modules/portal-review|portal-review]] | supervisor | announcementReview |
| [[modules/portal-analytics|portal-analytics]] | supervisor | portalAnalytics |
| [[modules/portal-analytics|portal-analytics]] | system | portalAnalytics |
| [[modules/system-observability|system-observability]] | system | observability |
| [[modules/system-observability|system-observability]] | endpoint | /api/bff/system/overview |
| [[modules/telemetry-audit|telemetry-audit]] | system | audit |
| [[modules/telemetry-audit|telemetry-audit]] | endpoint | /api/bff/system/ui-event-overview |
| [[modules/linebot-integration|linebot-integration]] | endpoint | /api/bff/employee/home |
| [[modules/linebot-integration|linebot-integration]] | endpoint | /api/bff/system/line-bot/service-status |
| [[modules/linebot-integration|linebot-integration]] | endpoint | /api/bff/system/line-bot/service-status/snapshots |
| [[modules/linebot-integration|linebot-integration]] | endpoint | /api/internal/service-health |
| [[modules/schedule-integration|schedule-integration]] | employee | shifts |
| [[modules/schedule-integration|schedule-integration]] | supervisor | staffing |
| [[modules/schedule-integration|schedule-integration]] | system | scheduleSnapshot |
| [[modules/schedule-integration|schedule-integration]] | endpoint | /api/bff/system/schedule-snapshot |
| [[modules/ragic-integration|ragic-integration]] | endpoint | /api/bff/system/health-overview |
| [[modules/gmail-integration|gmail-integration]] | system | gmailIntegration |
| [[modules/file-upload-export|file-upload-export]] | system | fileUploadExport |
| [[modules/legacy-users|legacy-users]] | system | legacyUsers |
| [[modules/facilities|facilities]] | system | facilities |
| [[modules/facilities|facilities]] | endpoint | /api/auth/me |
| [[modules/session-governance|session-governance]] | system | sessionGovernance |
| [[modules/session-governance|session-governance]] | endpoint | /api/auth/me |
| [[modules/user-role-snapshots|user-role-snapshots]] | system | userRoleSnapshots |
| [[modules/employee-resources|employee-resources]] | employee | documents |
| [[modules/employee-resources|employee-resources]] | supervisor | settings |
| [[modules/employee-training|employee-training]] | employee | training |
| [[modules/watchdog-events|watchdog-events]] | system | watchdogEvents |
| [[modules/watchdog-events|watchdog-events]] | endpoint | /api/bff/system/watchdog-events |
| [[modules/bff-projections|bff-projections]] | employee | home |
| [[modules/bff-projections|bff-projections]] | supervisor | dashboard |
| [[modules/bff-projections|bff-projections]] | system | overview |
| [[modules/integration-sync-jobs|integration-sync-jobs]] | system | integrationOverview |
| [[modules/integration-sync-jobs|integration-sync-jobs]] | endpoint | /api/bff/system/integration-overview |

## Extraction Candidates

- Route helper and redirect policy should stay centralized in `shared/navigation/workbench-routes.ts`.
- Status DTOs should stay under shared module/BFF contracts before page components consume them.
- Service health and watchdog DTOs should be read-only projections, not page-local fetch fan-out.
- Ragic candidate lookup should become one adapter contract before more whitelist-like modules are added.
- LINE Bot proxy calls should remain behind server endpoints; frontend should not call external hosts directly.
- Dashboard cards should be registry/BFF-driven so employee, supervisor, and system shells do not hardcode module lists.
