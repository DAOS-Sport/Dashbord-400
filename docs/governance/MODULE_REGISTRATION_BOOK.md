# 模組登記書

版本：2026-05-11  
狀態：草案，依目前 `shared/modules/*` 產生  
用途：作為 module registry、IT 監控、孤兒模組檢查、孤兒路由檢查的人工驗收文件。

## 1. 登記規則

每個正式模組都必須有以下欄位：

| 欄位 | 說明 |
|---|---|
| `moduleId` | 穩定 ID，不可重複 |
| `label` | 後台顯示名稱 |
| `母系統` | 8 大母系統之一 |
| `visibleRoles` | employee / lifeguard / supervisor / system / SYSTEM_ADMIN |
| `route` | 有頁面就必須掛在 workbench shell |
| `BFF/API` | UI 資料入口，不直接打外部 API |
| `data` | 對應 table/projection/source |
| `integration` | 外部服務，例如 Ragic、LINE、Schedule、Object Storage |
| `telemetry/audit` | 點擊、提交、查詢或高風險操作事件 |
| `status` | implemented / partial / planned / legacy / external / deprecated |

## 2. 目前總覽

| 指標 | 數量 |
|---|---:|
| Registry 模組總數 | 74 |
| 已分組 | 74 |
| 未分組 | 0 |
| 可疑未綁 BFF 使用者模組 | 0 |
| implemented | 24 |
| partial | 37 |
| planned | 6 |
| legacy | 4 |
| external | 2 |
| deprecated | 1 |

## 3. 母系統登記

### 3.1 入口、身分與場館權限

目的：登入、角色、activeFacility、首頁 shell 與權限快照，是所有工作台的母系統。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `auth` | employee, lifeguard, supervisor, system, SYSTEM_ADMIN | session、login、role/facility switch |
| `dashboard` | employee, lifeguard, supervisor, system | legacy dashboard 與 workbench shell orchestration |
| `employee-home` | employee | 員工首頁固定 slot 與 BFF |
| `facilities` | employee, lifeguard, supervisor, system | H05 場館、activeFacility、facility grant |
| `legacy-users` | system, SYSTEM_ADMIN | 舊 users 相容層 |
| `lifeguard-home` | lifeguard | 救生首頁與作業入口 |
| `session-governance` | system, SYSTEM_ADMIN | session index、role snapshot |
| `supervisor-dashboard` | supervisor | 主管首頁 |
| `system-dashboard` | system, SYSTEM_ADMIN | IT 首頁 |
| `user-role-snapshots` | system, SYSTEM_ADMIN | HR/Ragic role snapshot |

### 3.2 員工內容與日常工作

目的：員工首頁、活動、文件、教材、便利貼、場租查看與日常資料卡。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `activity-periods` | employee, supervisor | 活動檔期/課程快訊 |
| `campaigns-events` | employee, lifeguard, supervisor | 活動資料來源 |
| `checkins` | employee | 點名/報到預留 |
| `employee-resources` | employee, lifeguard, supervisor | 常用文件、教材資料 |
| `employee-settings` | employee | 員工設定 |
| `employee-training` | employee, lifeguard, supervisor, system | 員工教材與觀看紀錄 |
| `personal-note` | employee, lifeguard | 個人工作記事/便利貼 |
| `quick-links` | employee, lifeguard, supervisor | 快速入口相容/設定 |
| `registration-courses` | employee | 報名/課程預留 |
| `search` | employee, lifeguard, supervisor, system | 全站搜尋 |

### 3.3 救生作業與稽核

目的：救生首頁、照片/GPS 作業、失物、水道事項、主管觀察與 IT 稽核。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `lifeguard-cleanup` | lifeguard | 下班打掃照片 |
| `lifeguard-coach-dive` | lifeguard | 教練下水拍照 |
| `lifeguard-lane-issues` | lifeguard | 水道事項 |
| `lifeguard-lane-rentals` | lifeguard | 水道租借狀態唯讀 |
| `lifeguard-log` | lifeguard, supervisor, system | 救生員日誌 |
| `lifeguard-lost-and-found` | employee, lifeguard | 失物招領 |
| `lifeguard-water-quality` | lifeguard | 水質檢測照片 |
| `supervisor-lifeguard-overview` | supervisor, system | 主管救生紀錄總覽 |

### 3.4 主管營運模組

目的：主管端停車、櫃台日誌、水道租借、場地預約、任務、交接、異常與報表。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `analytics` | supervisor, system | 報表 |
| `anomalies` | supervisor, system | 異常審核 |
| `counter-log` | supervisor, system | 櫃台日誌 |
| `courts` | employee, supervisor, system | 場地預約/場租查看 |
| `handover` | employee, lifeguard, supervisor | 櫃台交接/交辦 |
| `lane-rentals` | supervisor, system | 水道租借 |
| `operations` | supervisor, system | 營運相容/彙整 |
| `parking` | supervisor, system | 停車場總覽 |
| `parking-contracts` | supervisor, system | 停車場租約 |
| `parking-event-days` | supervisor, system | 停車場活動日 |
| `parking-payments` | supervisor, system | 停車場付款審核 |
| `parking-plans` | supervisor, system | 停車場方案 |
| `parking-vehicles` | supervisor, system | 停車場車輛 |
| `tasks` | employee, lifeguard, supervisor | 任務管理 |

### 3.5 公告、通知與知識

目的：系統公告、LINE 群組公告、公告審核、收件人、通知與問答知識庫。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `announcement-groups` | supervisor, system | 場館 LINE 群組綁定 |
| `announcement-review` | supervisor, system | 公告審核 |
| `announcement-summary` | supervisor, system | 公告統計 |
| `announcements` | employee, lifeguard, supervisor, system | 公告檢視/管理 |
| `knowledge-base-qna` | employee, lifeguard, supervisor | 相關問題詢問 |
| `notification-center` | employee, lifeguard, supervisor, system | 通知中心 |
| `notification-recipients` | supervisor, system | 通知收件人 |
| `system-announcements` | employee, lifeguard, supervisor, system | 系統公告 |

### 3.6 IT 治理與觀察面

目的：功能關係、拓撲、健康檢查、稽核、Raw Inspector、Watchdog 與 BFF projections。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `bff-projections` | system, SYSTEM_ADMIN | BFF 投影 |
| `hr-audit` | system, SYSTEM_ADMIN | HR 稽核 |
| `raw-inspector` | system, SYSTEM_ADMIN | 白名單 Raw Inspector |
| `system-function-relations` | system, SYSTEM_ADMIN | 當前功能關係 |
| `system-health` | system, SYSTEM_ADMIN | 系統健康 |
| `system-lifeguard-audit` | system | 救生稽核 |
| `system-observability` | system, SYSTEM_ADMIN | 告警中心 |
| `system-topology` | system, SYSTEM_ADMIN | 模組拓撲圖 |
| `telemetry-audit` | system, SYSTEM_ADMIN | Audit / Telemetry |
| `watchdog-events` | system, SYSTEM_ADMIN | Watchdog events |

### 3.7 外部整合

目的：LINE Bot、排班、Ragic、Gmail、同步工作與外部資料源接線。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `booking-snapshot` | employee, lifeguard, supervisor, system | 場租/預約摘要 |
| `gmail-integration` | system | Gmail SMTP |
| `integration-sync-jobs` | system, SYSTEM_ADMIN | 同步工作 |
| `linebot-integration` | supervisor, system | LINE Bot |
| `ragic-integration` | system | Ragic |
| `schedule-integration` | employee, lifeguard, supervisor, system | 排班整合 |
| `shift-reminder` | employee, lifeguard, supervisor | 今日班表 |
| `weather-widget` | employee | 天氣卡片預留 |

### 3.8 Legacy / 相容層

目的：舊 portal、舊使用者、舊版面設定與仍保留相容的檔案匯出上傳。

| Module ID | 目前角色 | 管理重點 |
|---|---|---|
| `file-upload-export` | supervisor, system | 舊上傳/匯出 |
| `portal-analytics` | supervisor, system | 舊 portal 分析 |
| `portal-home` | employee, lifeguard | 舊 portal 首頁 |
| `portal-manage` | supervisor, system | 舊 portal 管理 |
| `portal-review` | supervisor, system | 舊 portal 審核 |
| `widget-layout-settings` | system | deprecated 版面設定 |

## 4. 角色入口登記

### Employee navigation

`employee-home`, `handover`, `activity-periods`, `employee-resources`, `employee-training`, `personal-note`, `lifeguard-lost-and-found`, `courts`, `knowledge-base-qna`, `checkins`

### Lifeguard navigation

`lifeguard-home`, `lifeguard-water-quality`, `lifeguard-coach-dive`, `lifeguard-cleanup`, `lifeguard-lane-issues`, `lifeguard-lost-and-found`, `lifeguard-lane-rentals`, `lifeguard-log`, `announcements`, `employee-training`, `knowledge-base-qna`

### Supervisor navigation

`supervisor-dashboard`, `facilities`, `parking`, `counter-log`, `lane-rentals`, `courts`, `tasks`, `announcements`, `announcement-groups`, `supervisor-lifeguard-overview`, `handover`, `employee-training`, `anomalies`, `analytics`

### System navigation

`system-dashboard`, `system-function-relations`, `system-topology`, `system-health`, `system-observability`, `integration-sync-jobs`, `telemetry-audit`, `system-lifeguard-audit`, `raw-inspector`, `employee-training`

## 5. 登記完成定義

一個 module 不能只新增頁面就算完成。至少要滿足：

1. `MODULE_IDS` 有 id。
2. `MODULE_REGISTRY` 有完整 definition。
3. `shared/modules/descriptors.ts` 有角色可見策略。
4. `shared/navigation/workbench-routes.ts` 有 primary route 或明確 background-only。
5. 若有首頁卡，必須有 BFF endpoint 或明確 `not_connected` DTO。
6. 若有寫入，必須有 audit action。
7. 若有外部資料，必須有 sourceStatus。
8. `npm run check:modules` 不報錯。
9. `npm run check:workbench-governance` 不報錯。
10. `npm run dry-run` 可跑完。

## 6. 孤兒檢查規則

### 6.1 孤兒模組

以下任一情況視為孤兒模組：

- 有 route，但沒有 registry entry。
- 有 BFF/API，但沒有 registry entry。
- 有 DB table 或 migration，但沒有 registry data binding。
- 有 UI card/sidebar，但 descriptor 沒有該 module。
- 有 topology node，但沒有 module id 對應。

### 6.2 孤兒路由

以下任一情況視為孤兒路由：

- App route 不屬於 workbench shell、portal、login、public sign link。
- supervisor route 還輸出 `/admin/*` 作為 primary。
- courts route 還輸出裸 `/courts/*` 作為正式入口。
- legacy route 不是 redirect，而是直接渲染舊白色 shell。

### 6.3 孤兒 API

以下任一情況視為孤兒 API：

- `server/routes.ts` 或 module route 有 endpoint，但 registry `apis` 沒登記。
- 前端直接呼叫 endpoint，但 descriptor/BFF 未標示。
- mutation API 沒有 audit policy。
- external API 直接被 client 呼叫。

## 7. 下一輪建議

若你驗收這份登記書，下一輪可直接實作：

1. `/system/modules`：把此 Markdown 登記書做成可搜尋 UI。
2. `/system/health`：把 route/BFF/API/audit 檢查做成表格。
3. `/system/alerts`：把 Watchdog 事件做成正式告警中心。
4. `npm run check:orphan-routes`：新增孤兒路由檢查腳本。
5. `npm run check:orphan-apis`：新增孤兒 API 檢查腳本。
