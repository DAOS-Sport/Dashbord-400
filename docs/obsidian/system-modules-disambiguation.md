# System Modules Disambiguation

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[cleanup-backlog|清洗 backlog]]

這頁專門處理 system / analytics / announcements / lifeguard 相關命名 overlap。未來新增 IT 模組前，先確認是否應該掛在下列表格的既有 owner。

| Module | Responsibility | Boundary | Do Not Confuse With |
| --- | --- | --- | --- |
| system-control-center | IT 首頁 / 快速入口 | 只聚合 KPI 與入口 tile；不得承載深層操作流程。 | system-dashboard |
| system-dashboard | Legacy system overview | 保留相容入口；新功能不得加在此模組。 | system-control-center |
| system-watchdog | 服務健康檢視 | 呈現 module health、external integration、watchdog 狀態。 | helper-status / watchdog-events |
| watchdog-events | 外部事件 ingestion source | 只代表事件資料來源；UI 統一由 system-watchdog 消費。 | system-watchdog |
| linebot-management | 400LINE 集中入口 | 集中看 400LINE 服務、群組/館別、白名單 snapshot、重要公告管線與 API readiness；read-only shell。 | system-watchdog / helper-status |
| helper-status | 400LINE 服務監控舊頁 | 只看 400LINE 連接服務、secret configured/missing、heartbeat/snapshot；後續收斂為 linebot-management 子頁。 | system-watchdog |
| system-operations | IT 人員協助 / soft intervention | 查人、reset session、refresh cache、resend notification；必須 audit。 | system-control-center |
| system-insights | 行為數據洞察 | 讀 telemetry 行為趨勢、completion rate、role/facility/time trend。 | analytics |
| system-governance | 治理 / registry / audit raw hub | 模組 registry、function relations、audit raw、topology notes 的收斂頁。 | system-function-relations |
| system-function-relations | Legacy function relations tab source | 只能作為 governance tab 的舊資料來源；不得新增獨立 route。 | system-governance |
| system-observability | Legacy observability tab source | 只能作為 Watchdog/Governance 的舊入口來源。 | system-watchdog |
| analytics | Supervisor/admin legacy analytics | 主管營運報表與舊 admin analytics。 | portal-analytics / system-insights |
| portal-analytics | Portal usage analytics | Portal event/facility usage reporting。 | analytics |
| announcements | 員工可見公告 feed | 員工首頁/公告列表顯示 LINE group + local system announcements。 | announcement-review / announcement-groups |
| announcement-groups | 場館 LINE 群組綁定 | 管理 facility -> LINE group binding，不負責審核公告內容。 | announcements |
| announcement-review | LINE candidate 審核 | 主管審核 LINE Bot 候選公告 approve/reject。 | announcements |
| announcement-summary | 公告統計 / 週報 | 看 summary/report，不負責公告 CRUD。 | announcements |
| system-announcements | 本地系統公告 CRUD | 主管維護本地 notices，員工端消費。 | announcements |
| lifeguard-log | 救生員日誌與填報 | 第一線 lifeguard 作業輸入與日報。 | facilities |
| facilities | 主管場館狀態 | 主管觀察單館櫃台交辦與救生功能模組狀態，不做第一線填報。 | lifeguard-log |

## Rules

- 新 IT page 預設先掛到 `system-governance` tab 或 `system-watchdog` tab，除非有獨立 BFF owner。
- 400CMS 監控看 `system-control-center` / `system-watchdog` / `system-governance`；400LINE 外部服務看 `linebot-management`。
- 服務健康看 `system-watchdog`；400LINE 服務細節先看 `linebot-management`，舊細節頁保留在 `helper-status`；事件 ingestion 看 `watchdog-events`。
- 公告顯示看 `announcements`；群組綁定看 `announcement-groups`；審核看 `announcement-review`；統計看 `announcement-summary`。
- 行為數據看 `system-insights`；主管營運報表保留在 `analytics`；portal usage 看 `portal-analytics`。
