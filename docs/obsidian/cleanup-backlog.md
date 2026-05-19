# Cleanup Backlog

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[bff-reference-map|BFF Reference Map]] / [[bff-technical-spec|BFF 技術規範]]

這裡只記錄需要最後集中處理的功能與行為問題。本階段不混入產品行為精修。

## Fixed In This Pass

| Area | Evidence | Resolution |
| --- | --- | --- |
| TypeScript gate | `npm run type-check` previously failed in employee home section timestamps, announcement widget cache iteration, employee home enrichment nullable type, and registry provider typing. | Replaced page timestamp reads with `section.meta.lastSyncAt`, made cache invalidation iteration target-safe, normalized nullable source errors, and registered `CWA` as an integration provider. |
| Employee announcement smoke | `npm run smoke:modules` previously failed the employee BFF announcement merge assertion. | Employee home enrichment now merges LINE group announcements, employee resource announcements, portal/system announcements, and candidate important announcements before overlay, de-dupe, and sort. |
| Runtime topology drift | Governance previously found `/system/topology` mounted as an unregistered independent runtime route. | Removed the independent App route and routed the legacy path to `/system/governance`. |
| BFF technical governance | BFF rules previously lived only in scattered implementation/tests. | Added [[bff-technical-spec]] and linked it from module pages and [[bff-reference-map]]. |
| System BFF owner split | `server/modules/system/routes.ts` still owned helper status and operations endpoints after 400LINE extraction. | Split helper status into `helper-status-routes.ts`, operations into `operations-routes.ts`, and added `npm run smoke:auth-bff` for authenticated read-only BFF coverage. |
| UI state governance | Section 9 UI/UX rules were prose-only and not auditable. | Added registry `bff.uiStates` / `bff.freshness`, shared UI state components, `npm run check:ui-states`, and `npm run check:title-binding`. |

## Must Fix Before Structural Split

| Area | Evidence | Intended Fix |
| --- | --- | --- |
| Large shared persistence/schema files | `server/storage.ts` and `shared/schema.ts` are > 1.5k lines each. | Split by domain ownership after type-check baseline is stable. |

## High Priority Red Flags

| Module | Flag | Required Decision |
| --- | --- | --- |
| portal-manage | partial + no BFF | Legacy entry still exists without BFF section contract; keep only as compatibility or add sunset date. |
| gmail-integration | partial + no BFF + system visible | System-visible integration must be read through BFF or explicitly background-only. |
| legacy-users | legacy + no BFF | Compatibility layer needs sunset rule or explicit background-only classification. |
| widget-layout-settings | deprecated/legacy + no BFF | Deprecated registry entry should keep sunset notes and must not gain new UI flows. |

## BFF UI State Contract Gaps

These modules have BFF bindings but do not yet declare auditable `uiStates` and `freshness`. `npm run check:ui-states` reports this list without failing so the migration can proceed module by module.

| Module | Roles | BFF Binding | Required Fix |
| --- | --- | --- | --- |
| [[modules/auth|auth]] | employee, lifeguard, supervisor, system, SYSTEM_ADMIN | systemSectionKey: `auth`<br>plannedEndpoint: `/api/auth/me` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/dashboard|dashboard]] | employee, lifeguard, supervisor, system | employeeSectionKey: `home`<br>supervisorSectionKey: `dashboard`<br>systemSectionKey: `overview`<br>plannedEndpoint: `/api/bff/employee/home`<br>plannedEndpoint: `/api/bff/supervisor/dashboard`<br>plannedEndpoint: `/api/bff/system/overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/employee-home|employee-home]] | employee | employeeSectionKey: `home`<br>plannedEndpoint: `/api/bff/employee/home` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-home|lifeguard-home]] | lifeguard | employeeSectionKey: `lifeguardHome`<br>plannedEndpoint: `/api/bff/lifeguard/home` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-log|lifeguard-log]] | lifeguard, supervisor, system | employeeSectionKey: `lifeguardLog`<br>supervisorSectionKey: `lifeguardLog` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/supervisor-dashboard|supervisor-dashboard]] | supervisor | supervisorSectionKey: `dashboard`<br>plannedEndpoint: `/api/bff/supervisor/dashboard` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-dashboard|system-dashboard]] | system, SYSTEM_ADMIN | systemSectionKey: `overview`<br>plannedEndpoint: `/api/bff/system/overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-control-center|system-control-center]] | system, SYSTEM_ADMIN | systemSectionKey: `controlCenter`<br>plannedEndpoint: `/api/bff/system/control-center` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-watchdog|system-watchdog]] | system, SYSTEM_ADMIN | systemSectionKey: `watchdog`<br>plannedEndpoint: `/api/bff/system/watchdog-events`<br>plannedEndpoint: `/api/bff/system/integration-overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-insights|system-insights]] | system, SYSTEM_ADMIN | systemSectionKey: `insights`<br>plannedEndpoint: `/api/bff/system/insights/overview`<br>plannedEndpoint: `/api/bff/system/insights/module/:moduleId` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-governance|system-governance]] | system, SYSTEM_ADMIN | systemSectionKey: `governance`<br>plannedEndpoint: `/api/modules/registry`<br>plannedEndpoint: `/api/audit/logs` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/line-whitelist|line-whitelist]] | system, SYSTEM_ADMIN | systemSectionKey: `lineWhitelist`<br>plannedEndpoint: `/api/bff/system/line-whitelist`<br>plannedEndpoint: `/api/bff/system/line-whitelist/candidates`<br>plannedEndpoint: `/api/internal/line-whitelist/check`<br>plannedEndpoint: `/api/cms/system/caution-permissions`<br>plannedEndpoint: `/api/cms/system/caution-permissions/candidates`<br>plannedEndpoint: `/api/cms/system/caution-permissions/check` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-water-quality|lifeguard-water-quality]] | lifeguard | plannedEndpoint: `/api/bff/lifeguard/home`<br>plannedEndpoint: `/api/bff/lifeguard/records` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | lifeguard | plannedEndpoint: `/api/bff/lifeguard/home` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-cleanup|lifeguard-cleanup]] | lifeguard | plannedEndpoint: `/api/bff/lifeguard/home` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | lifeguard | plannedEndpoint: `/api/bff/lifeguard/home` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | lifeguard, employee | plannedEndpoint: `/api/bff/employee/lost-and-found`<br>plannedEndpoint: `/api/bff/lifeguard/home`<br>plannedEndpoint: `/api/bff/lifeguard/lost-and-found` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | lifeguard | plannedEndpoint: `/api/bff/lifeguard/lane-rentals` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-function-relations|system-function-relations]] | system, SYSTEM_ADMIN | systemSectionKey: `functionRelations` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/operations|operations]] | system, supervisor | supervisorSectionKey: `legacyOperations`<br>plannedEndpoint: `/api/bff/supervisor/dashboard` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/lane-rentals|lane-rentals]] | supervisor, system | supervisorSectionKey: `laneRentals` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/courts|courts]] | employee, supervisor, system | employeeSectionKey: `courts`<br>supervisorSectionKey: `courts`<br>plannedEndpoint: `/api/courts/xinbei/stats` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/parking|parking]] | supervisor, system | supervisorSectionKey: `parking` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/parking-vehicles|parking-vehicles]] | supervisor, system | supervisorSectionKey: `parkingVehicles` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/parking-plans|parking-plans]] | supervisor, system | supervisorSectionKey: `parkingPlans` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/parking-contracts|parking-contracts]] | supervisor, system | supervisorSectionKey: `parkingContracts` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/parking-payments|parking-payments]] | supervisor, system | supervisorSectionKey: `parkingPayments` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/parking-event-days|parking-event-days]] | supervisor, system | supervisorSectionKey: `parkingEventDays` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/hr-audit|hr-audit]] | system, SYSTEM_ADMIN | systemSectionKey: `audit`<br>plannedEndpoint: `/api/hr-audit` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-health|system-health]] | system, SYSTEM_ADMIN | systemSectionKey: `health`<br>plannedEndpoint: `/api/bff/system/health-overview`<br>plannedEndpoint: `/api/bff/system/integration-overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/announcement-groups|announcement-groups]] | supervisor, system | employeeSectionKey: `announcements`<br>supervisorSectionKey: `announcementGroups`<br>plannedEndpoint: `/api/bff/employee/home`<br>plannedEndpoint: `/api/integrations/announcement-groups/messages` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/announcement-review|announcement-review]] | supervisor, system | supervisorSectionKey: `announcementReview`<br>plannedEndpoint: `/api/announcement-candidates` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/announcement-summary|announcement-summary]] | supervisor, system | supervisorSectionKey: `announcementSummary`<br>plannedEndpoint: `/api/announcement-dashboard/summary` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-announcements|system-announcements]] | employee, lifeguard, supervisor, system | employeeSectionKey: `announcements`<br>supervisorSectionKey: `announcements` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/anomalies|anomalies]] | system | supervisorSectionKey: `pendingAnomalies`<br>systemSectionKey: `alerts` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/notification-recipients|notification-recipients]] | system, supervisor | systemSectionKey: `notificationRecipients`<br>plannedEndpoint: `/api/notification-recipients` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/campaigns-events|campaigns-events]] | employee, lifeguard, supervisor | employeeSectionKey: `campaigns` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/booking-snapshot|booking-snapshot]] | employee, lifeguard, supervisor, system | employeeSectionKey: `bookingSnapshot`<br>plannedEndpoint: `/api/bff/employee/home` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/shift-reminder|shift-reminder]] | employee, lifeguard, supervisor | employeeSectionKey: `shifts`<br>supervisorSectionKey: `shifts`<br>systemSectionKey: `scheduleSnapshot`<br>plannedEndpoint: `/api/bff/system/schedule-snapshot` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/quick-links|quick-links]] | employee, lifeguard, supervisor | employeeSectionKey: `shortcuts` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/notification-center|notification-center]] | employee, lifeguard, supervisor, system | employeeSectionKey: `notifications`<br>supervisorSectionKey: `notifications`<br>systemSectionKey: `notifications` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/knowledge-base-qna|knowledge-base-qna]] | employee, lifeguard, supervisor | employeeSectionKey: `qna` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/activity-periods|activity-periods]] | employee, supervisor | employeeSectionKey: `events` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/registration-courses|registration-courses]] | employee | employeeSectionKey: `registrationCourses` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/employee-settings|employee-settings]] | employee | employeeSectionKey: `settings` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/search|search]] | employee, lifeguard, supervisor, system | employeeSectionKey: `search`<br>supervisorSectionKey: `search`<br>systemSectionKey: `search` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/weather-widget|weather-widget]] | employee | employeeSectionKey: `weather` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/group-broadcasts|group-broadcasts]] | employee, lifeguard, supervisor, system | employeeSectionKey: `announcements`<br>supervisorSectionKey: `groupBroadcasts` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/portal-home|portal-home]] | employee, lifeguard | employeeSectionKey: `home`<br>plannedEndpoint: `/api/bff/employee/home` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/portal-manage|portal-manage]] | supervisor, system | supervisorSectionKey: `portalManage` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/portal-review|portal-review]] | supervisor, system | supervisorSectionKey: `announcementReview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/portal-analytics|portal-analytics]] | supervisor, system | supervisorSectionKey: `portalAnalytics`<br>systemSectionKey: `portalAnalytics` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/system-observability|system-observability]] | system, SYSTEM_ADMIN | systemSectionKey: `observability`<br>plannedEndpoint: `/api/bff/system/overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/telemetry-audit|telemetry-audit]] | system, SYSTEM_ADMIN | systemSectionKey: `audit`<br>plannedEndpoint: `/api/bff/system/ui-event-overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/linebot-integration|linebot-integration]] | system, supervisor | plannedEndpoint: `/api/bff/employee/home`<br>plannedEndpoint: `/api/bff/system/line-bot/service-status`<br>plannedEndpoint: `/api/bff/system/line-bot/service-status/snapshots`<br>plannedEndpoint: `/api/internal/service-health` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/schedule-integration|schedule-integration]] | system, supervisor, employee, lifeguard | employeeSectionKey: `shifts`<br>supervisorSectionKey: `staffing`<br>systemSectionKey: `scheduleSnapshot`<br>plannedEndpoint: `/api/bff/system/schedule-snapshot` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/ragic-integration|ragic-integration]] | system, SYSTEM_ADMIN | plannedEndpoint: `/api/bff/system/health-overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/gmail-integration|gmail-integration]] | system | systemSectionKey: `gmailIntegration` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/file-upload-export|file-upload-export]] | system, supervisor | systemSectionKey: `fileUploadExport` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/legacy-users|legacy-users]] | system, SYSTEM_ADMIN | systemSectionKey: `legacyUsers` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/facilities|facilities]] | employee, lifeguard, supervisor, system | systemSectionKey: `facilities`<br>plannedEndpoint: `/api/auth/me` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/session-governance|session-governance]] | system, SYSTEM_ADMIN | systemSectionKey: `sessionGovernance`<br>plannedEndpoint: `/api/auth/me` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/user-role-snapshots|user-role-snapshots]] | system, SYSTEM_ADMIN | systemSectionKey: `userRoleSnapshots` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/employee-resources|employee-resources]] | employee, lifeguard, supervisor | employeeSectionKey: `documents`<br>supervisorSectionKey: `settings` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/employee-training|employee-training]] | employee, lifeguard, supervisor, system | employeeSectionKey: `training` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/watchdog-events|watchdog-events]] | system, SYSTEM_ADMIN | systemSectionKey: `watchdogEvents`<br>plannedEndpoint: `/api/bff/system/watchdog-events` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/bff-projections|bff-projections]] | system, SYSTEM_ADMIN | employeeSectionKey: `home`<br>supervisorSectionKey: `dashboard`<br>systemSectionKey: `overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |
| [[modules/integration-sync-jobs|integration-sync-jobs]] | system, SYSTEM_ADMIN | systemSectionKey: `integrationOverview`<br>plannedEndpoint: `/api/bff/system/integration-overview` | 補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。 |

## Partial Module Readiness

| Module | Category | Gap To Implemented | Governance Notes |
| --- | --- | --- | --- |
| [[modules/lifeguard-home|lifeguard-home]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned | Desktop structure and mobile operation entry share the same module config. |
| [[modules/lifeguard-log|lifeguard-log]] | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy | Detailed lifeguard log remains the bridge while operation modules are completed. |
| [[modules/supervisor-dashboard|supervisor-dashboard]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned | Supervisor dashboard is the official shell entry; legacy admin dashboard redirects away. |
| [[modules/lifeguard-water-quality|lifeguard-water-quality]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | GPS is required before capture; Nominatim/Object Storage degrade without breaking UI. |
| [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Use work-log task categories; no standalone schema in this pass. |
| [[modules/lifeguard-cleanup|lifeguard-cleanup]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Use work-log task categories; no standalone schema in this pass. |
| [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | 水道事項 stays under lifeguard work-log and lane-rentals context. |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Employee UI stays under /employee and lifeguard UI stays under /lifeguard; BFF endpoints map both entries to the same facility-scoped lost-and-found table. |
| [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Lifeguard page must stay readonly. |
| [[modules/courts|courts]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Use one canonical courts module; school-specific pages remain child routes. |
| [[modules/hr-audit|hr-audit]] | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy | HR audit write behavior is not fully implemented yet. |
| [[modules/announcement-review|announcement-review]] | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy | Review actions must eventually write audit logs. |
| [[modules/announcement-summary|announcement-summary]] | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy | Summary reads upstream report data; local persistence is not complete. |
| [[modules/campaigns-events|campaigns-events]] | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy | Employee-created campaign/event content is allowed but scoped by facility. |
| [[modules/booking-snapshot|booking-snapshot]] | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned | Planned only; connect through booking adapter before exposing as real data. |
| [[modules/shift-reminder|shift-reminder]] | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy | Schedule data should enter through adapter/projection, not direct frontend calls. |
| [[modules/notification-center|notification-center]] | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned | Planned module; requires event policy before implementation. |
| [[modules/knowledge-base-qna|knowledge-base-qna]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Employees can create and answer their own Q&A; supervisor/system governance can curate later. |
| [[modules/activity-periods|activity-periods]] | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；路由仍 partial/legacy | Employee can view and use entry points; supervisor remains content governance owner. |
| [[modules/registration-courses|registration-courses]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Not connected; renders not-connected surface through EmployeeMorePage. |
| [[modules/employee-settings|employee-settings]] | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy | Settings is a route-level support surface, not a sidebar module. |
| [[modules/search|search]] | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy | Search is a shared background capability, not a dedicated route. |
| [[modules/portal-manage|portal-manage]] | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy | Legacy manage route aggregates multiple modules and remains registered as a composite. |
| [[modules/portal-review|portal-review]] | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy | Legacy portal review should be replaced by supervisor announcement module over time. |
| [[modules/schedule-integration|schedule-integration]] | 上線後補 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned | Schedule truth must stay behind adapter/BFF boundaries. |
| [[modules/ragic-integration|ragic-integration]] | 上線後補 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned | External HR authority; RagicCacheService primes on server start and refreshes every 5 minutes. |
| [[modules/gmail-integration|gmail-integration]] | 上線後補 | 缺 uiStates / freshness | Partial because SMTP depends on env credentials and has only a test route. |
| [[modules/facilities|facilities]] | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned | Facility mapping is shared domain truth; route guards must not trust URL alone. |
| [[modules/session-governance|session-governance]] | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned | Partial until Redis/opaque session and CSRF hardening are complete. |
| [[modules/user-role-snapshots|user-role-snapshots]] | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned | Snapshots are supporting evidence, not an employee-editable surface. |
| [[modules/employee-training|employee-training]] | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy | Employee reader, supervisor material management, and system training-view report are wired; still partial until role-specific acceptance coverage is complete. |
| [[modules/bff-projections|bff-projections]] | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned | BFF projection tables are derived state; source truth stays in source systems or local domain tables. |

## Title Binding Candidates

`npm run check:title-binding` blocks corrupted title text and lists hardcoded `<h1>` candidates. These need to be moved to module registry display names or explicitly marked as non-module pages.

| File | Current h1 | Required Fix |
| --- | --- | --- |
| `client\src\modules\employee\home\employee-home-page.tsx` | 工作台暫時無法載入 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\modules\employee\qna\page.tsx` | 問答資料庫 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\modules\supervisor\qna-review\page.tsx` | 待審核問答 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\modules\system\control-center\page.tsx` | 系統總控台 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\modules\system\function-relations\page.tsx` | 資料母表、子表與功能邏輯關係 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\modules\workbench\login-page.tsx` | 駿斯 CMS | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\analytics.tsx` | 決策與數據洞察 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\announcement-summary.tsx` | 公告分析總覽 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\announcements.tsx` | 候選公告審核 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\anomaly-reports.tsx` | 打卡異常管理 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\courts\_components\app-header.tsx` | 場租查看 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\hr-audit.tsx` | HR 與權限稽核 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\not-found.tsx` | 404 Page Not Found | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\operations.tsx` | 跨館資源監控 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\parking\sign.tsx` | 夢想體育學院新北高中 — 停車場租約 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\portal\portal-login.tsx` | 員工值班入口 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\portal\portal-setup.tsx` | 此設備尚未設定館別 | 改成 registry displayName / route manifest 或明確標為例外。 |
| `client\src\pages\portal\portal-work-log.tsx` | · 救生員日誌 | 改成 registry displayName / route manifest 或明確標為例外。 |

## Should Fix Soon

| Area | Evidence | Intended Fix |
| --- | --- | --- |
| Work-item retirement deploy | `migrations/0014_retire_tasks_personal_note.sql` drops the legacy `tasks` table and deletes `employee_resources.category='sticky_note'`; `scripts/post-merge.sh` applies it through `scripts/apply-db-retirement-migrations.cjs`. | On Replit deploy, verify postMerge sees `NEON_DATABASE_URL` or `DATABASE_URL`, then confirm `tasks` table is gone and no sticky-note rows remain. |
| Employee home file size | `client/src/modules/employee/home/employee-home-page.tsx` is > 2k lines and owns UI, DTO mapping, state, and fallback rendering. | Extract stable sections into domain files without changing layout behavior. |
| System route file size | `server/modules/system/routes.ts` still owns control center, watchdog, integration overview, insights, schedule snapshot, and internal webhook endpoints. | Continue with governance, watchdog, insights, schedule snapshot, and internal webhook route extraction by module. |
| Governance docs drift | Older governance docs still name removed observer modules such as `system-topology`. | Point those references to `system-governance` tabs or archive them. |
| Ragic candidate adapter | Whitelist candidate lookup and future modules need consistent Ragic field mapping. | Create a shared Ragic candidate adapter contract: name, lineUserId, phone, department, source table. |
| LINE 400 feature authorization | UI currently manages feature switches, but external 400LINE sync needs a single clear contract. | Document and validate the internal API payload before touching production secrets. |
| Build warnings | Production build still reports stale Browserslist data, a PostCSS `from` warning, and large JS chunk warning. | Separate maintenance pass: update browserslist DB, identify PostCSS plugin source, then code-split large route bundles. |

## Nice To Have

| Area | Evidence | Intended Fix |
| --- | --- | --- |
| Obsidian doc regeneration | `npm run docs:obsidian` now regenerates the module knowledge base. | Add it to release checklist after it stabilizes. |
| Route inventory depth | Current docs are registry-derived; raw Express/frontend route inventory is still separate. | Add route scanners that emit orphan route candidates into this backlog. |
| Module intake skill | Future modules must answer role, Ragic/database, and purpose. | Promote the three-field rule into Replit/Codex governance docs after first cleanup batch. |
