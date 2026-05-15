# Module Governance

Last generated: 2026-05-15T09:08:37.699Z

## 治理原則

- Source of truth: code manifest in `shared/modules/registry.ts`.
- `module_settings` DB table is legacy/cache only; production navigation and permissions must not depend on it.
- Any module id, route, permission, visibility, or role exposure change must update the code manifest and rerun `npm run docs:module-governance`.
- DB governance can be reconsidered only after there is a migration plan, drift detector, rollback path, and ownership model.

## Canonical Module IDs

Total: 78

| # | id | label | status | domain |
|---|---|---|---|---|
| 1 | `auth` | Authentication and Session | implemented | core |
| 2 | `dashboard` | Dashboard | implemented | derived |
| 3 | `employee-home` | 員工首頁 | implemented | derived |
| 4 | `lifeguard-home` | 救生首頁 | partial | derived |
| 5 | `lifeguard-log` | 救生員日誌 | partial | core |
| 6 | `supervisor-dashboard` | 主管儀表板 | partial | derived |
| 7 | `system-dashboard` | 系統總覽 | legacy | system |
| 8 | `system-control-center` | 系統控制中心 | implemented | system |
| 9 | `system-watchdog` | Watchdog | implemented | system |
| 10 | `system-operations` | 運維協助中心 | implemented | system |
| 11 | `system-insights` | 行為洞察 | implemented | system |
| 12 | `system-governance` | 治理面 | implemented | system |
| 13 | `helper-status` | 400小幫手狀態檢視 | implemented | system |
| 14 | `line-whitelist` | 400 LINE 白名單管理 | implemented | system |
| 15 | `lifeguard-water-quality` | 水質檢測 | partial | support |
| 16 | `lifeguard-coach-dive` | 教練下水 | partial | support |
| 17 | `lifeguard-cleanup` | 下班打掃 | partial | support |
| 18 | `lifeguard-lane-issues` | 水道事項 | partial | support |
| 19 | `lifeguard-lost-and-found` | 失物招領 | partial | support |
| 20 | `lifeguard-lane-rentals` | 水道租借狀態 | partial | support |
| 21 | `supervisor-lifeguard-overview` | 救生紀錄總覽 | partial | support |
| 22 | `system-function-relations` | 當前功能關係 | legacy | system |
| 23 | `analytics` | Analytics | partial | derived |
| 24 | `operations` | Operations | legacy | derived |
| 25 | `counter-log` | Counter Log | partial | core |
| 26 | `lane-rentals` | Lane Rentals | implemented | core |
| 27 | `courts` | Courts | partial | core |
| 28 | `parking` | Parking Management | implemented | core |
| 29 | `parking-vehicles` | Parking Vehicles | implemented | core |
| 30 | `parking-plans` | Parking Plans | implemented | core |
| 31 | `parking-contracts` | Parking Contracts | implemented | core |
| 32 | `parking-payments` | Parking Payments | implemented | core |
| 33 | `parking-event-days` | Parking Event Days | implemented | core |
| 34 | `hr-audit` | HR Audit | partial | support |
| 35 | `system-health` | System Health | legacy | system |
| 36 | `announcements` | Announcements | partial | core |
| 37 | `announcement-groups` | Announcement Groups | implemented | support |
| 38 | `announcement-review` | Announcement Review | partial | support |
| 39 | `announcement-summary` | Announcement Summary | partial | derived |
| 40 | `system-announcements` | System Announcements | implemented | core |
| 41 | `tasks` | Tasks | implemented | core |
| 42 | `handover` | 櫃台交接 | implemented | core |
| 43 | `anomalies` | Anomalies | implemented | core |
| 44 | `notification-recipients` | Notification Recipients | implemented | support |
| 45 | `campaigns-events` | Campaigns and Events | partial | support |
| 46 | `booking-snapshot` | Booking Snapshot | planned | integration |
| 47 | `shift-reminder` | Shift Reminder | partial | integration |
| 48 | `quick-links` | Quick Links | implemented | support |
| 49 | `notification-center` | Notification Center | planned | support |
| 50 | `knowledge-base-qna` | 相關問題詢問 | partial | support |
| 51 | `personal-note` | 個人工作貼 | partial | support |
| 52 | `activity-periods` | 活動檔期 / 課程快訊 | partial | support |
| 53 | `registration-courses` | 報名 / 課程 | planned | support |
| 54 | `checkins` | 點名 / 報到 | planned | support |
| 55 | `employee-settings` | 員工設定 | partial | support |
| 56 | `search` | 快速搜尋 | partial | support |
| 57 | `weather-widget` | 天氣卡片 | planned | integration |
| 58 | `portal-home` | Portal Home | legacy | legacy |
| 59 | `portal-manage` | Portal Manage | partial | legacy |
| 60 | `portal-review` | Portal Review | partial | legacy |
| 61 | `portal-analytics` | Portal Analytics | implemented | derived |
| 62 | `system-observability` | System Observability | legacy | system |
| 63 | `telemetry-audit` | Telemetry and Audit | legacy | system |
| 64 | `linebot-integration` | LINE Bot Assistant Integration | external | integration |
| 65 | `schedule-integration` | Smart Schedule Integration | partial | integration |
| 66 | `ragic-integration` | Ragic Integration | external | integration |
| 67 | `gmail-integration` | Gmail SMTP Integration | partial | integration |
| 68 | `file-upload-export` | File Upload and Export | legacy | support |
| 69 | `legacy-users` | Legacy Users | legacy | legacy |
| 70 | `facilities` | Facilities | partial | core |
| 71 | `session-governance` | Session Governance | partial | system |
| 72 | `user-role-snapshots` | User Role Snapshots | partial | system |
| 73 | `employee-resources` | Employee Resources | implemented | support |
| 74 | `employee-training` | Employee Training | partial | support |
| 75 | `widget-layout-settings` | Widget Layout Settings | deprecated | support |
| 76 | `watchdog-events` | Watchdog Events | legacy | system |
| 77 | `bff-projections` | BFF Projections | partial | derived |
| 78 | `integration-sync-jobs` | Integration Sync Jobs | legacy | integration |

## Role Permission Matrix

| module | employee | lifeguard | supervisor | system | SYSTEM_ADMIN |
|---|---|---|---|---|---|
| `auth` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `dashboard` | ✅ | ✅ | ✅ | ✅ |  |
| `employee-home` | ✅ |  |  |  |  |
| `lifeguard-home` |  | ✅ |  |  |  |
| `lifeguard-log` |  | ✅ | ✅ | ✅ |  |
| `supervisor-dashboard` |  |  | ✅ |  |  |
| `system-dashboard` |  |  |  | ✅ | ✅ |
| `system-control-center` |  |  |  | ✅ | ✅ |
| `system-watchdog` |  |  |  | ✅ | ✅ |
| `system-operations` |  |  |  | ✅ | ✅ |
| `system-insights` |  |  |  | ✅ | ✅ |
| `system-governance` |  |  |  | ✅ | ✅ |
| `helper-status` |  |  |  | ✅ | ✅ |
| `line-whitelist` |  |  |  | ✅ | ✅ |
| `lifeguard-water-quality` |  | ✅ |  |  |  |
| `lifeguard-coach-dive` |  | ✅ |  |  |  |
| `lifeguard-cleanup` |  | ✅ |  |  |  |
| `lifeguard-lane-issues` |  | ✅ |  |  |  |
| `lifeguard-lost-and-found` | ✅ | ✅ |  |  |  |
| `lifeguard-lane-rentals` |  | ✅ |  |  |  |
| `supervisor-lifeguard-overview` |  |  | ✅ | ✅ |  |
| `system-function-relations` |  |  |  | ✅ | ✅ |
| `analytics` |  |  | ✅ | ✅ |  |
| `operations` |  |  | ✅ | ✅ |  |
| `counter-log` |  |  | ✅ | ✅ |  |
| `lane-rentals` |  |  | ✅ | ✅ |  |
| `courts` | ✅ |  | ✅ | ✅ |  |
| `parking` |  |  | ✅ | ✅ |  |
| `parking-vehicles` |  |  | ✅ | ✅ |  |
| `parking-plans` |  |  | ✅ | ✅ |  |
| `parking-contracts` |  |  | ✅ | ✅ |  |
| `parking-payments` |  |  | ✅ | ✅ |  |
| `parking-event-days` |  |  | ✅ | ✅ |  |
| `hr-audit` |  |  |  | ✅ | ✅ |
| `system-health` |  |  |  | ✅ | ✅ |
| `announcements` | ✅ | ✅ | ✅ | ✅ |  |
| `announcement-groups` |  |  | ✅ | ✅ |  |
| `announcement-review` |  |  | ✅ | ✅ |  |
| `announcement-summary` |  |  | ✅ | ✅ |  |
| `system-announcements` | ✅ | ✅ | ✅ | ✅ |  |
| `tasks` | ✅ | ✅ | ✅ |  |  |
| `handover` | ✅ | ✅ | ✅ |  |  |
| `anomalies` |  |  | ✅ | ✅ |  |
| `notification-recipients` |  |  | ✅ | ✅ |  |
| `campaigns-events` | ✅ | ✅ | ✅ |  |  |
| `booking-snapshot` | ✅ | ✅ | ✅ | ✅ |  |
| `shift-reminder` | ✅ | ✅ | ✅ |  |  |
| `quick-links` | ✅ | ✅ | ✅ |  |  |
| `notification-center` | ✅ | ✅ | ✅ | ✅ |  |
| `knowledge-base-qna` | ✅ | ✅ | ✅ |  |  |
| `personal-note` | ✅ | ✅ |  |  |  |
| `activity-periods` | ✅ |  | ✅ |  |  |
| `registration-courses` | ✅ |  |  |  |  |
| `checkins` | ✅ |  |  |  |  |
| `employee-settings` | ✅ |  |  |  |  |
| `search` | ✅ | ✅ | ✅ | ✅ |  |
| `weather-widget` | ✅ |  |  |  |  |
| `portal-home` | ✅ | ✅ |  |  |  |
| `portal-manage` |  |  | ✅ | ✅ |  |
| `portal-review` |  |  | ✅ | ✅ |  |
| `portal-analytics` |  |  | ✅ | ✅ |  |
| `system-observability` |  |  |  | ✅ | ✅ |
| `telemetry-audit` |  |  |  | ✅ | ✅ |
| `linebot-integration` |  |  | ✅ | ✅ |  |
| `schedule-integration` | ✅ | ✅ | ✅ | ✅ |  |
| `ragic-integration` |  |  |  | ✅ | ✅ |
| `gmail-integration` |  |  |  | ✅ |  |
| `file-upload-export` |  |  | ✅ | ✅ |  |
| `legacy-users` |  |  |  | ✅ | ✅ |
| `facilities` | ✅ | ✅ | ✅ | ✅ |  |
| `session-governance` |  |  |  | ✅ | ✅ |
| `user-role-snapshots` |  |  |  | ✅ | ✅ |
| `employee-resources` | ✅ | ✅ | ✅ |  |  |
| `employee-training` | ✅ | ✅ | ✅ | ✅ |  |
| `widget-layout-settings` |  |  |  | ✅ |  |
| `watchdog-events` |  |  |  | ✅ | ✅ |
| `bff-projections` |  |  |  | ✅ | ✅ |
| `integration-sync-jobs` |  |  |  | ✅ | ✅ |

## 上線後遷移計畫

1. Keep code manifest authoritative through launch.
2. Treat `module_settings` as a read-through cache only after drift checks exist.
3. Add a DB-backed governance layer only when module ownership, approval workflow, rollback, and seed/migration ownership are explicit.
4. Before enabling DB governance, run a one-way reconciliation report from DB to code manifest and review every diff.
