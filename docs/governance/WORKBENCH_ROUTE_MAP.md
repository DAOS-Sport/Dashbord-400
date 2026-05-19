# Workbench Route Map

This is the human-readable route map for the current workbench. The canonical source is `shared/navigation/workbench-routes.ts`.

## Employee

| Module | Primary Route | Shell |
|---|---|---|
| `employee-home` | `/employee` | employee |
| `announcements` | `/employee/announcements` | employee |
| `handover` | `/employee/handover` | employee |
| `activity-periods` | `/employee/activity-periods` | employee |
| `employee-resources` | `/employee/documents` | employee |
| `employee-training` | `/employee/training` | employee |
| `lifeguard-lost-and-found` | `/employee/lost-and-found` | employee |
| `courts` | `/employee/courts/xinbei` | employee |
| `knowledge-base-qna` | `/employee/qna` | employee |

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
| `handover` | `/lifeguard/handover` | lifeguard |

## Supervisor

| Module | Primary Route | Legacy Compatibility |
|---|---|---|
| `supervisor-dashboard` | `/supervisor` | `/` |
| `facilities` | `/supervisor/facilities`, `/supervisor/facilities/:facilityKey` | - |
| `parking` | `/supervisor/parking` | `/admin/parking/dashboard` |
| `lane-rentals` | `/supervisor/lane-rentals` | `/admin/lane-rentals` |
| `courts` | `/supervisor/courts/xinbei` | `/courts/xinbei` |
| `announcements` | `/supervisor/announcements` | `/announcements` |
| `announcement-groups` | `/supervisor/announcement-groups` | `/admin/announcement-groups` |
| `handover` | `/supervisor/handover` | - |
| `employee-training` | `/supervisor/training` | - |

## System

| Module | Primary Route | Shell |
|---|---|---|
| `system-control-center` | `/system` | system |
| `system-watchdog` | `/system/watchdog` | system |
| `system-operations` | `/system/operations` | system |
| `system-insights` | `/system/insights` | system |
| `system-governance` | `/system/governance` | system |
| `linebot-management` | `/system/linebot-management` | system |
| `helper-status` | `/system/lineXBS-status` | system |
| `line-whitelist` | `/system/line-whitelist` | system |

## Legacy Redirect Rules

Legacy paths are compatibility only. They must redirect to workbench routes and must not render the old white admin shell.

| Legacy Path | Redirect |
|---|---|
| `/` | `/system` |
| `/analytics` | `/system/insights` |
| `/operations` | `/supervisor` |
| `/anomaly-reports` | `/system/alerts` |
| `/employee/tasks`, `/employee/personal-note` | `/employee/handover` |
| `/supervisor/tasks` | `/supervisor/handover` |
| `/lifeguard/tasks` | `/lifeguard/handover` |
| `/system-health`, `/system/health`, `/system/alerts`, `/system/integrations` | `/system/watchdog` |
| `/system/function-relations`, `/system/audit`, `/system/training-views`, `/system/topology` | `/system/governance` |
| `/announcements`, `/announcements/summary` | `/supervisor/announcements` |
| `/admin/announcement-groups` | `/supervisor/announcement-groups` |
| `/admin/parking/*` | `/supervisor/parking/*` |
| `/admin/lane-rentals` | `/supervisor/lane-rentals` |
| `/courts/*` | `/supervisor/courts/*` |

## Route QA Commands

```bash
npm run check:workbench-governance
npm run unit:modules
npm run smoke:modules
```
