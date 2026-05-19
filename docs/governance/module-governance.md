# Module Governance

Last generated: 2026-05-19T13:04:44.441Z

## 治理原則

- Source of truth: code manifest in `shared/modules/registry.ts`.
- `module_settings` DB table is legacy/cache only; production navigation and permissions must not depend on it.
- Any module id, route, permission, visibility, or role exposure change must update the code manifest and rerun `npm run docs:module-governance`.
- DB governance can be reconsidered only after there is a migration plan, drift detector, rollback path, and ownership model.

## Canonical Module IDs

Total: 74

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
| 13 | `linebot-management` | 400LINE 管理 | implemented | system |
| 14 | `helper-status` | 400LINE 服務監控 | implemented | system |
| 15 | `line-whitelist` | 400 LINE 白名單管理 | implemented | system |
| 16 | `lifeguard-water-quality` | 水質檢測 | partial | support |
| 17 | `lifeguard-coach-dive` | 教練下水 | partial | support |
| 18 | `lifeguard-cleanup` | 下班打掃 | partial | support |
| 19 | `lifeguard-lane-issues` | 水道事項 | partial | support |
| 20 | `lifeguard-lost-and-found` | 失物招領 | partial | support |
| 21 | `lifeguard-lane-rentals` | 水道租借狀態 | partial | support |
| 22 | `system-function-relations` | 當前功能關係 | legacy | system |
| 23 | `operations` | Operations | legacy | derived |
| 24 | `lane-rentals` | Lane Rentals | implemented | core |
| 25 | `courts` | Courts | partial | core |
| 26 | `parking` | Parking Management | implemented | core |
| 27 | `parking-vehicles` | Parking Vehicles | implemented | core |
| 28 | `parking-plans` | Parking Plans | implemented | core |
| 29 | `parking-contracts` | Parking Contracts | implemented | core |
| 30 | `parking-payments` | Parking Payments | implemented | core |
| 31 | `parking-event-days` | Parking Event Days | implemented | core |
| 32 | `hr-audit` | HR Audit | partial | support |
| 33 | `system-health` | System Health | legacy | system |
| 34 | `announcements` | Announcements | implemented | core |
| 35 | `announcement-groups` | Announcement Groups | implemented | support |
| 36 | `announcement-review` | Announcement Review | partial | support |
| 37 | `announcement-summary` | Announcement Summary | partial | derived |
| 38 | `system-announcements` | System Announcements | implemented | core |
| 39 | `handover` | 交辦事項 | implemented | core |
| 40 | `anomalies` | Anomalies | implemented | core |
| 41 | `notification-recipients` | Notification Recipients | implemented | support |
| 42 | `campaigns-events` | Campaigns and Events | partial | support |
| 43 | `booking-snapshot` | Booking Snapshot | partial | integration |
| 44 | `shift-reminder` | Shift Reminder | partial | integration |
| 45 | `quick-links` | Quick Links | implemented | support |
| 46 | `notification-center` | Notification Center | partial | support |
| 47 | `knowledge-base-qna` | 相關問題詢問 | partial | support |
| 48 | `activity-periods` | 活動檔期 / 課程快訊 | partial | support |
| 49 | `registration-courses` | 報名 / 課程 | partial | support |
| 50 | `employee-settings` | 員工設定 | partial | support |
| 51 | `search` | 快速搜尋 | partial | support |
| 52 | `weather-widget` | 天氣卡片 | implemented | integration |
| 53 | `group-broadcasts` | 群組重要公告 | implemented | core |
| 54 | `portal-home` | Portal Home | legacy | legacy |
| 55 | `portal-manage` | Portal Manage | partial | legacy |
| 56 | `portal-review` | Portal Review | partial | legacy |
| 57 | `portal-analytics` | Portal Analytics | implemented | derived |
| 58 | `system-observability` | System Observability | legacy | system |
| 59 | `telemetry-audit` | Telemetry and Audit | legacy | system |
| 60 | `linebot-integration` | LINE Bot Assistant Integration | external | integration |
| 61 | `schedule-integration` | Smart Schedule Integration | partial | integration |
| 62 | `ragic-integration` | Ragic Integration | partial | integration |
| 63 | `gmail-integration` | Gmail SMTP Integration | partial | integration |
| 64 | `file-upload-export` | File Upload and Export | legacy | support |
| 65 | `legacy-users` | Legacy Users | legacy | legacy |
| 66 | `facilities` | Facilities | partial | core |
| 67 | `session-governance` | Session Governance | partial | system |
| 68 | `user-role-snapshots` | User Role Snapshots | partial | system |
| 69 | `employee-resources` | Employee Resources | implemented | support |
| 70 | `employee-training` | Employee Training | partial | support |
| 71 | `widget-layout-settings` | Widget Layout Settings | deprecated | support |
| 72 | `watchdog-events` | Watchdog Events | legacy | system |
| 73 | `bff-projections` | BFF Projections | partial | derived |
| 74 | `integration-sync-jobs` | Integration Sync Jobs | legacy | integration |

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
| `linebot-management` |  |  |  | ✅ | ✅ |
| `helper-status` |  |  |  | ✅ | ✅ |
| `line-whitelist` |  |  |  | ✅ | ✅ |
| `lifeguard-water-quality` |  | ✅ |  |  |  |
| `lifeguard-coach-dive` |  | ✅ |  |  |  |
| `lifeguard-cleanup` |  | ✅ |  |  |  |
| `lifeguard-lane-issues` |  | ✅ |  |  |  |
| `lifeguard-lost-and-found` | ✅ | ✅ |  |  |  |
| `lifeguard-lane-rentals` |  | ✅ |  |  |  |
| `system-function-relations` |  |  |  | ✅ | ✅ |
| `operations` |  |  | ✅ | ✅ |  |
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
| `handover` | ✅ | ✅ | ✅ |  |  |
| `anomalies` |  |  |  | ✅ |  |
| `notification-recipients` |  |  | ✅ | ✅ |  |
| `campaigns-events` | ✅ | ✅ | ✅ |  |  |
| `booking-snapshot` | ✅ | ✅ | ✅ | ✅ |  |
| `shift-reminder` | ✅ | ✅ | ✅ |  |  |
| `quick-links` | ✅ | ✅ | ✅ |  |  |
| `notification-center` | ✅ | ✅ | ✅ | ✅ |  |
| `knowledge-base-qna` | ✅ | ✅ | ✅ |  |  |
| `activity-periods` | ✅ |  | ✅ |  |  |
| `registration-courses` | ✅ |  |  |  |  |
| `employee-settings` | ✅ |  |  |  |  |
| `search` | ✅ | ✅ | ✅ | ✅ |  |
| `weather-widget` | ✅ |  |  |  |  |
| `group-broadcasts` | ✅ | ✅ | ✅ | ✅ |  |
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
