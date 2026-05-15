# Workbench Route Map

This is the human-readable route map for the current workbench. The canonical source is `shared/navigation/workbench-routes.ts`.

## Employee

| Module | Primary Route | Shell |
|---|---|---|
| `employee-home` | `/employee` | employee |
| `handover` | `/employee/handover` | employee |
| `activity-periods` | `/employee/activity-periods` | employee |
| `employee-resources` | `/employee/documents` | employee |
| `employee-training` | `/employee/training` | employee |
| `personal-note` | `/employee/personal-note` | employee |
| `lifeguard-lost-and-found` | `/employee/lost-and-found` | employee |
| `courts` | `/employee/courts/xinbei` | employee |
| `knowledge-base-qna` | `/employee/qna` | employee |
| `checkins` | `/employee/checkins` | employee |

## Lifeguard

| Module | Primary Route | Shell |
|---|---|---|
| `lifeguard-home` | `/lifeguard` | lifeguard |
| `lifeguard-water-quality` | `/lifeguard/water-quality` | lifeguard |
| `lifeguard-coach-dive` | `/lifeguard/coach-dive` | lifeguard |
| `lifeguard-cleanup` | `/lifeguard/cleanup` | lifeguard |
| `lifeguard-lane-issues` | `/lifeguard/lane-issues` | lifeguard |
| `lifeguard-lost-and-found` | `/lifeguard/lost-and-found` | lifeguard |
| `lifeguard-lane-rentals` | `/lifeguard/lane-rentals` | lifeguard |
| `lifeguard-log` | `/lifeguard/log` | lifeguard |
| `announcements` | `/employee/announcements` | lifeguard |
| `employee-training` | `/employee/training` | lifeguard |
| `knowledge-base-qna` | `/employee/qna` | lifeguard |

## Supervisor

| Module | Primary Route | Legacy Compatibility |
|---|---|---|
| `supervisor-dashboard` | `/supervisor` | `/` |
| `facilities` | `/supervisor/facilities` | - |
| `parking` | `/supervisor/parking` | `/admin/parking/dashboard` |
| `counter-log` | `/supervisor/counter-log/submissions` | `/admin/counter-logs/submissions` |
| `lane-rentals` | `/supervisor/lane-rentals` | `/admin/lane-rentals` |
| `courts` | `/supervisor/courts/xinbei` | `/courts/xinbei` |
| `tasks` | `/supervisor/tasks` | - |
| `announcements` | `/supervisor/announcements` | `/announcements` |
| `announcement-groups` | `/supervisor/announcement-groups` | `/admin/announcement-groups` |
| `supervisor-lifeguard-overview` | `/supervisor/lifeguard-overview` | - |
| `handover` | `/supervisor/handover` | - |
| `employee-training` | `/supervisor/training` | - |
| `anomalies` | `/supervisor/anomalies` | `/anomaly-reports` |
| `analytics` | `/supervisor/reports` | `/analytics` |

## System

| Module | Primary Route | Shell |
|---|---|---|
| `system-dashboard` | `/system` | system |
| `system-function-relations` | `/system/function-relations` | system |
| `system-topology` | `/system/topology` | system |
| `system-health` | `/system/health` | system |
| `system-observability` | `/system/alerts` | system |
| `integration-sync-jobs` | `/system/integrations` | system |
| `telemetry-audit` | `/system/audit` | system |
| `system-lifeguard-audit` | `/system/lifeguard-audit` | system |
| `raw-inspector` | `/system/raw-inspector` | system |
| `employee-training` | `/system/training-views` | system |

## Legacy Redirect Rules

Legacy paths are compatibility only. They must redirect to workbench routes and must not render the old white admin shell.

| Legacy Path | Redirect |
|---|---|
| `/` | `/system` |
| `/analytics` | `/supervisor/reports` |
| `/operations` | `/supervisor` |
| `/anomaly-reports` | `/supervisor/anomalies` |
| `/announcements`, `/announcements/summary` | `/supervisor/announcements` |
| `/admin/announcement-groups` | `/supervisor/announcement-groups` |
| `/admin/parking/*` | `/supervisor/parking/*` |
| `/admin/lane-rentals` | `/supervisor/lane-rentals` |
| `/admin/counter-logs/*` | `/supervisor/counter-log/*` |
| `/courts/*` | `/supervisor/courts/*` |

## Route QA Commands

```bash
npm run check:workbench-governance
npm run unit:modules
npm run smoke:modules
```
