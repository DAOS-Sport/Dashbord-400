# Partial Implementation Audit

[[00-index|模組總覽]] / [[cleanup-backlog|清洗 backlog]]

Partial 只能表示核心可用但有缺角；若長期不補，就要改成 legacy / deprecated / planned。這頁把 32 個 partial 分成「能上線」「上線後補」「砍掉重練 / sunset 候選」三類。

| Module | Roles | Category | Gap To Implemented |
| --- | --- | --- | --- |
| [[modules/lifeguard-home|lifeguard-home]] | lifeguard | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned |
| [[modules/lifeguard-log|lifeguard-log]] | lifeguard, supervisor, system | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy |
| [[modules/supervisor-dashboard|supervisor-dashboard]] | supervisor | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned |
| [[modules/lifeguard-water-quality|lifeguard-water-quality]] | lifeguard | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/lifeguard-coach-dive|lifeguard-coach-dive]] | lifeguard | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/lifeguard-cleanup|lifeguard-cleanup]] | lifeguard | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/lifeguard-lane-issues|lifeguard-lane-issues]] | lifeguard | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/lifeguard-lost-and-found|lifeguard-lost-and-found]] | lifeguard, employee | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/lifeguard-lane-rentals|lifeguard-lane-rentals]] | lifeguard | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/supervisor-lifeguard-overview|supervisor-lifeguard-overview]] | supervisor, system | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/analytics|analytics]] | supervisor, system | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/counter-log|counter-log]] | supervisor, system | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy |
| [[modules/courts|courts]] | employee, supervisor, system | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/hr-audit|hr-audit]] | system, SYSTEM_ADMIN | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/announcement-review|announcement-review]] | supervisor, system | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/announcement-summary|announcement-summary]] | supervisor, system | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/campaigns-events|campaigns-events]] | employee, lifeguard, supervisor | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy |
| [[modules/shift-reminder|shift-reminder]] | employee, lifeguard, supervisor | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/knowledge-base-qna|knowledge-base-qna]] | employee, lifeguard, supervisor | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/personal-note|personal-note]] | employee, lifeguard | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy |
| [[modules/activity-periods|activity-periods]] | employee, supervisor | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；路由仍 partial/legacy |
| [[modules/employee-settings|employee-settings]] | employee | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy |
| [[modules/search|search]] | employee, lifeguard, supervisor, system | 能上線 | 缺 uiStates / freshness；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/portal-manage|portal-manage]] | supervisor, system | 砍掉重練 / sunset 候選 | 缺 BFF / section contract；缺 uiStates / freshness；路由仍 partial/legacy |
| [[modules/portal-review|portal-review]] | supervisor, system | 能上線 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned；路由仍 partial/legacy |
| [[modules/schedule-integration|schedule-integration]] | system, supervisor, employee, lifeguard | 上線後補 | 缺 uiStates / freshness；仍依賴 legacy/proxy endpoint；資料層仍 partial/planned |
| [[modules/gmail-integration|gmail-integration]] | system | 上線後補 | 缺 BFF / section contract；缺 uiStates / freshness |
| [[modules/facilities|facilities]] | employee, lifeguard, supervisor, system | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned |
| [[modules/session-governance|session-governance]] | system, SYSTEM_ADMIN | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned |
| [[modules/user-role-snapshots|user-role-snapshots]] | system, SYSTEM_ADMIN | 上線後補 | 缺 BFF / section contract；缺 uiStates / freshness；資料層仍 partial/planned |
| [[modules/employee-training|employee-training]] | employee, lifeguard, supervisor, system | 能上線 | 缺 uiStates / freshness；路由仍 partial/legacy |
| [[modules/bff-projections|bff-projections]] | system, SYSTEM_ADMIN | 上線後補 | 缺 uiStates / freshness；資料層仍 partial/planned |
