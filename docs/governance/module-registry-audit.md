# Module Registry Audit

Date: 2026-04-27

## Existing Frontend Pages

Legacy admin pages:

- `/` -> `dashboard`
- `/analytics` -> `analytics`
- `/operations` -> `operations`
- `/hr-audit` -> `hr-audit`
- `/system-health` -> `system-health`
- `/anomaly-reports` -> `anomalies`, `notification-recipients`
- `/announcements` -> `announcement-review`
- `/announcements/summary` -> `announcement-summary`

Legacy portal pages:

- `/portal/login` -> `auth`, `ragic-integration`
- `/portal` -> `portal-home`
- `/portal/:facilityKey` -> `portal-home`
- `/portal/:facilityKey/announcements` -> `announcements`
- `/portal/:facilityKey/announcements/:id` -> `announcements`
- `/portal/:facilityKey/handover` -> `handover`
- `/portal/:facilityKey/campaigns` -> `campaigns-events`
- `/portal/:facilityKey/shift` -> `shift-reminder`
- `/portal/:facilityKey/manage` -> `portal-manage`, `quick-links`, `system-announcements`, `employee-resources`, `widget-layout-settings`
- `/portal/:facilityKey/analytics` -> `portal-analytics`
- `/portal/:facilityKey/review` -> `portal-review`, `announcement-review`

New workbench pages:

- `/employee`, `/employee/home` -> `dashboard`, `portal-home`
- `/employee/tasks` -> `tasks`
- `/employee/announcements` -> `announcements`, `campaigns-events`
- `/employee/handover` -> `handover`
- `/employee/shift` -> `shift-reminder`
- `/employee/more` -> `quick-links`, `employee-resources`, `personal-note`
- `/supervisor`, `/supervisor/home` -> `dashboard`
- `/supervisor/tasks` -> `tasks`
- `/supervisor/announcements` -> `announcement-review`, `announcements`
- `/supervisor/anomalies` -> `anomalies`
- `/supervisor/people` -> `facilities`, `user-role-snapshots`
- `/supervisor/handover` -> `handover`
- `/supervisor/reports` -> `analytics`, `portal-analytics`
- `/supervisor/settings` -> `quick-links`, `system-announcements`, `widget-layout-settings`
- `/system`, `/system/overview` -> `dashboard`, `system-observability`
- `/system/alerts` -> `anomalies`, `watchdog-events`
- `/system/integrations` -> `system-health`, `integration-sync-jobs`
- `/system/audit` -> `telemetry-audit`, `portal-analytics`
- `/system/raw-inspector` -> `raw-inspector`

## Existing APIs

Auth and Ragic:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/active-facility`
- `POST /api/auth/active-role`
- `POST /api/auth/ragic-login`

Anomaly and recipients:

- `POST /api/anomaly-report`
- `GET /api/anomaly-reports`
- `GET /api/anomaly-reports/:id`
- `PATCH /api/anomaly-reports/:id/resolution`
- `PATCH /api/anomaly-reports/batch/resolution`
- `DELETE /api/anomaly-reports/:id`
- `GET /api/notification-recipients`
- `POST /api/notification-recipients`
- `PATCH /api/notification-recipients/:id`
- `DELETE /api/notification-recipients/:id`

Portal and local employee resources:

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`
- `GET /api/announcements/acknowledgements`
- `POST /api/announcements/:id/ack`
- `GET /api/portal/handovers`
- `POST /api/portal/handovers`
- `DELETE /api/portal/handovers/:id`
- `GET /api/portal/operational-handovers`
- `POST /api/portal/operational-handovers`
- `PATCH /api/portal/operational-handovers/:id`
- `PATCH /api/portal/operational-handovers/:id/report`
- `DELETE /api/portal/operational-handovers/:id`
- `GET /api/portal/layout-settings`
- `PATCH /api/portal/layout-settings`
- `GET /api/portal/quick-links`
- `POST /api/portal/quick-links`
- `PATCH /api/portal/quick-links/:id`
- `DELETE /api/portal/quick-links/:id`
- `GET /api/portal/employee-resources`
- `POST /api/portal/employee-resources`
- `PATCH /api/portal/employee-resources/:id`
- `DELETE /api/portal/employee-resources/:id`
- `GET /api/portal/system-announcements`
- `POST /api/portal/system-announcements`
- `PATCH /api/portal/system-announcements/:id`
- `DELETE /api/portal/system-announcements/:id`
- `POST /api/portal/events`
- `GET /api/portal/analytics`

LINE Bot Assistant proxy:

- `GET /api/announcement-dashboard/summary`
- `GET /api/announcement-candidates`
- `GET /api/announcement-candidates/:id`
- `POST /api/announcement-candidates/:id/approve`
- `POST /api/announcement-candidates/:id/reject`
- `GET /api/announcement-reports/weekly`
- `GET /api/facility-home/:groupId/home`
- `GET /api/facility-home/:groupId/announcements`
- `GET /api/facility-home/:groupId/announcements/:id`
- `GET /api/facility-home/:groupId/today-shift`
- `GET /api/facility-home/:groupId/handover`
- `POST /api/facility-home/:groupId/announcements/:id/ack`

Schedule and system:

- `GET /api/admin/overview`
- `GET /api/admin/interview-users`
- `GET /api/bff/system/schedule-snapshot`
- `GET /api/bff/system/health-overview`
- `GET /api/bff/system/integration-overview`
- `GET /api/bff/system/watchdog-events`
- `POST /api/watchdog/events`

BFF and telemetry:

- `GET /api/bff/employee/home`
- `GET /api/bff/employee/search`
- `GET /api/bff/supervisor/dashboard`
- `GET /api/bff/system/overview`
- `POST /api/telemetry/ui-events`
- `POST /api/telemetry/client-error`
- `GET /api/bff/system/ui-event-overview`

Export and upload:

- `GET /api/announcement-candidates/export/all`
- `GET /exports/:filename`
- `POST /api/test-email`

New debug registry APIs:

- `GET /api/system/module-registry`
- `GET /api/system/module-registry/:id`
- `GET /api/system/module-registry-role/:role`

## Existing DB Tables

- `users` -> `legacy-users`, `auth`
- `facilities` -> `facilities`
- `sessions_index` -> `session-governance`, `auth`
- `user_role_snapshots` -> `user-role-snapshots`, `hr-audit`, `session-governance`
- `auth_audit_logs` -> `auth`, `hr-audit`
- `anomaly_reports` -> `anomalies`
- `notification_recipients` -> `notification-recipients`, `gmail-integration`
- `tasks` -> `tasks`
- `handover_entries` -> `handover`
- `operational_handovers` -> `handover`
- `quick_links` -> `quick-links`, `portal-manage`
- `employee_resources` -> `employee-resources`, `campaigns-events`, `personal-note`
- `system_announcements` -> `system-announcements`, `announcements`, `portal-manage`
- `announcement_acknowledgements` -> `announcements`
- `portal_events` -> `portal-analytics`, `telemetry-audit`
- `widget_layout_settings` -> `widget-layout-settings`
- `watchdog_events` -> `watchdog-events`
- `audit_logs` -> `telemetry-audit`, `raw-inspector`
- `ui_events` -> `telemetry-audit`
- `integration_error_logs` -> `system-observability`, `integration-sync-jobs`
- `sync_job_runs` -> `integration-sync-jobs`
- `bff_latency_logs` -> `telemetry-audit`, `system-observability`
- `employee_home_projection` -> `bff-projections`, `dashboard`, `portal-home`
- `supervisor_dashboard_projection` -> `bff-projections`, `dashboard`
- `system_overview_projection` -> `bff-projections`, `system-observability`
- `source_snapshots` -> `integration-sync-jobs`, `linebot-integration`, `schedule-integration`

## Existing Integrations

- Ragic -> `ragic-integration`, `auth`, `hr-audit`, `user-role-snapshots`
- LINE Bot Assistant -> `linebot-integration`, `announcements`, `portal-home`, `announcement-review`, `shift-reminder`
- Smart Schedule Manager -> `schedule-integration`, `shift-reminder`, `handover`, `hr-audit`
- Gmail SMTP -> `gmail-integration`, `anomalies`, `notification-recipients`
- Postgres/Neon -> local domain tables and projections
- Local uploads/exports -> `file-upload-export`
- LocalStorage legacy hint -> `auth` only as legacy note, not authority

## Registered But Not Fully Wired

- `announcements`: partial; employee read/search/ack is wired, but supervisor review and external LINE candidate governance remain split.
- `booking-snapshot`: planned; booking adapter boundary exists but no real provider route.
- `notification-center`: planned; needs event policy first.
- `knowledge-base-qna`: planned; no local KB/RAG storage should be added without approval.
- `raw-inspector`: partial; UI exists, server-side audit remains planned.
- `integration-sync-jobs`: planned; tables exist but runner/write path is not implemented.
- `bff-projections`: partial; projection tables exist, fallback assembly is still active.
- `session-governance`: partial; session auth exists, hardening is still incomplete.

## Orphan Items

No high-risk page/API/table remains unregistered after this pass.

Known composite routes:

- `/portal/:facilityKey/manage` intentionally belongs to multiple modules.
- `/anomaly-reports` intentionally covers both anomaly reports and notification recipients.
- `/employee/announcements` currently covers announcements and campaign/event surfacing.

## Next Development Order

1. `tasks`: now owns a dedicated `tasks` table and CRUD route; next pass should add migration/runtime seed coverage and task telemetry events.
2. `announcements`: employee read/search/ack is wired; next pass should merge local system announcements, LINE candidates, and supervisor review into one BFF policy.
3. `handover`: keep it focused on handover/shift notes only, then move legacy route logic out of `server/routes.ts`.
