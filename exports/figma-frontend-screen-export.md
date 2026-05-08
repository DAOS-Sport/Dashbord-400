# Figma Frontend Screen Export

最後更新：2026-04-27
來源 repo：`D:\駿斯工作內容\02-repos\400qian-duan-yi-biao-ban`
用途：將目前前端所有畫面與大型模組整理成 Figma / Claude Design 可重建的頁面架構。

## 1. Figma 檔案建議結構

```text
400Qian Frontend Design Export
├─ 00 Cover / Scope
├─ 01 Design Tokens
├─ 02 Shared Components
├─ 03 Portal / Facility Screens
├─ 04 Employee Workbench
├─ 05 Supervisor Workbench
├─ 06 System Governance
├─ 07 Legacy Admin
└─ 08 States / Empty / Loading / Error
```

建議 frame 尺寸：

- Desktop：1440 x 1024
- Tablet：834 x 1194
- Mobile：390 x 844
- Dashboard 寬度：內容最大 1240-1600，依 shell 類型不同

## 2. Design Tokens

### Portal Tokens

Portal 來源：`client/src/index.css` 的 `.portal` 區塊。

```text
Primary Navy: #001d42
Navy Container: #19335a
Secondary Teal: #006b60
Accent Teal: #1CB4A3
Lime Green: #8DC63F / #9dd84f
Surface: #ffffff
Background: #f7f9fb
Surface Low: #f2f4f6
Text Primary: #191c1e
Text Secondary: #44474e
Outline: #74777f
Outline Variant: #c4c6cf
Headline Font: Manrope / Noto Sans TC
Body Font: Inter / Noto Sans TC
Card Radius: 24px
Pill Radius: 9999px
Topbar Height: 64px
Desktop Sidebar Width: 256px
```

Portal 視覺語言：

- 深藍玻璃導覽
- 白底 bento card
- 青綠到萊姆綠漸層 CTA
- 大標題偏場館品牌感
- 手機版有 top search 與 bottom nav

### Workbench Tokens

Workbench 來源：`client/src/index.css` 的 `.workbench-shell` 區塊。

```text
Navy: #10233f
Navy Strong: #0d2a50
Sidebar Blue: #1f3f68
Teal: #1cb4a3
Lime: #79d146
Blue: #2f6fe8
Red: #ff4964
Amber: #ef7d22
Surface: #ffffff
Surface Soft: #f7fafc
Border: #dfe8f2
Muted Text: #637185
Card Radius: 8px
Employee Sidebar Width: 232px
Supervisor/System Sidebar Width: 216px
Content Max Width: 1240-1280px
```

Workbench 視覺語言：

- 工作台型儀表板
- 資訊密度高
- KPI 數字清楚
- 卡片圓角固定 8px
- 左側導覽 + 頂部工具列 + 手機底部導覽
- 顏色只用於狀態、優先級、告警與 CTA

## 3. Shared Components

### Shell Components

```text
PortalShell
用途：Portal 場館入口共用外框
包含：固定 topbar、深藍 sidebar、搜尋、通知、使用者頭像、手機 drawer、手機 bottom nav
來源：client/src/components/portal/PortalShell.tsx

EmployeeShell
用途：員工工作台內頁外框
包含：桌面 sidebar、sticky header、RoleSwitcher、場館切換、回首頁、手機 bottom nav
來源：client/src/modules/employee/employee-shell.tsx

RoleShell
用途：主管端與系統治理端外框
包含：角色導覽、角色切換、通知、日期/場館 pill、手機 bottom nav
來源：client/src/modules/workbench/role-shell.tsx
```

### Card Components

```text
BentoCard
用途：Portal card
變體：white、navy
特徵：24px radius、ambient shadow、Portal token colors
來源：client/src/components/portal/BentoCard.tsx

WorkbenchCard
用途：Workbench card
變體：light、navy
特徵：8px radius、border、soft shadow、hover lift
來源：client/src/shared/ui-kit/workbench-card.tsx
```

### Portal Reusable Modules

```text
HandoverGrid：首頁交接摘要
MustReadList：必讀公告清單
CampaignHero：活動主視覺卡
AnnouncementDrawer：公告抽屜詳情
```

### Common UI

```text
Button、Input、Textarea、Select、Switch、Tabs、Badge、Dialog、Drawer、Toast、Table、Chart、Tooltip
來源：client/src/components/ui/*
```

## 4. Portal / Facility Screens

場館 config：`xinbei_pool`、`salu_counter`、`songshan_pool`、`sanmin_pool`。
所有場館使用同一套 Portal screen template，主要差異來自 facility name、contact points、section flags。

### /portal/login

Figma frame name：`Portal / Login`

主要模組：

- Brand header：駿斯 Kinetic Ops
- Login card：員工編號、手機、登入 CTA
- Facility context：登入後依 active facility 導向
- Loading / error / validation states

### /portal

Figma frame name：`Portal / Facility Setup`

主要模組：

- 場館選擇卡片
- 已登入但未綁定場館狀態
- 每張卡顯示 facility name、short name、area

### /portal/xinbei_pool

Figma frame name：`Portal / Facility Home / xinbei_pool`

主要模組：

- Page header：場館名稱、今日日期、當班人數
- HandoverGrid：櫃台交接摘要，桌面 8 欄寬
- MustReadList：必讀公告，桌面 4 欄寬
- Quick Links：常用網址，6 欄快捷入口
- Shift / Check-in：今日班表、點名打卡、回報異常
- Directory / Announcements：聯絡窗口、公司公告
- CampaignHero：活動檔期重點
- System Announcements：系統公告與嚴重等級
- AnnouncementDrawer：點擊公告後的右側/覆蓋詳情

### /portal/xinbei_pool/announcements

Figma frame name：`Portal / Announcements`

主要模組：

- Type tabs：全部、規則 SOP、通知公告、活動/折扣
- Count label：公告筆數
- Search interaction：由 PortalShell 搜尋控制
- Announcement row：icon、title、summary、type、detectedAt、chevron
- Empty state：沒有符合的公告
- Loading skeleton
- AnnouncementDrawer

### /portal/xinbei_pool/announcements/:id

Figma frame name：`Portal / Announcement Detail`

主要模組：

- Detail header：title、type/status、time
- Summary block
- Recommended action
- Recommended reply
- Bad example / original text
- Acknowledge button
- Back navigation

### /portal/xinbei_pool/handover

Figma frame name：`Portal / Handover`

主要模組：

- New entry card：icon、title、author/facility context
- Textarea：2000 字限制
- Submit button
- Recent list：author avatar、author name、employee number、created time、content
- Delete action：作者或主管可見
- Empty state / loading skeleton

### /portal/xinbei_pool/campaigns

Figma frame name：`Portal / Campaigns`

主要模組：

- Campaign card grid：desktop 3 欄
- Navy card background
- Candidate type label
- Title / summary
- Effective date range
- Empty state
- Loading skeleton

### /portal/xinbei_pool/shift

Figma frame name：`Portal / Shift`

主要模組：

- Today shift list：員工 avatar、姓名、職務、時段、已打卡 badge
- Empty state：尚未設定今日班表
- Quick card：開啟智能排班系統、回報打卡異常
- External link CTA

### /portal/xinbei_pool/manage

Figma frame name：`Portal / Manage`

主要模組：

- Quick Links CRUD：標題、icon、URL、描述、啟用 switch、新增/更新/取消
- Quick links list：icon、title、url、edit、delete、active/inactive
- System Announcements CRUD：title、content、severity select、active switch
- System announcement list：severity color、edit、delete、inactive state
- Supervisor only redirect state

### /portal/xinbei_pool/review

Figma frame name：`Portal / Review`

主要模組：

- PortalShell wrapper
- Embedded admin announcement review
- White rounded container
- Supervisor only redirect state

### /portal/xinbei_pool/analytics

Figma frame name：`Portal / Analytics`

主要模組：

- Header card：total events、range selector 1/7/30/90 days
- Event mix cards：type count、percentage progress
- Targets heatmap：stock-market style treemap
- Employees heatmap
- Daily volume horizontal bars
- Empty state / loading state
- Supervisor only redirect state

## 5. Employee Workbench Screens

### /employee

Figma frame name：`Employee / Home`

主要模組：

- DesktopSidebar：員工工作台導覽
- TopBar：RoleSwitcher、FacilitySwitcher、通知、avatar
- Hero search：快速搜尋公告、交接、班表、入口、常見問題
- Search results dropdown
- Weather card
- Handover card：交接事項與任務混合摘要
- Tutor booking placeholder
- Must-read announcements navy card
- Shortcuts grid
- Lower grid：今日班表、活動/課程快訊、常用文件、便利貼
- Add resource forms：活動、文件、便利貼
- Mobile bottom nav

### /employee/tasks

Figma frame name：`Employee / Tasks`

主要模組：

- KPI cards：待處理、已完成、目前館別
- Task list card
- Task item：status icon、title、content、status badge、priority badge、target date/shift、due at、report note
- Actions：自領、回報、完成
- Success message / error / empty state

### /employee/announcements

Figma frame name：`Employee / Announcements`

主要模組：

- KPI cards：公告總數、必讀、資料狀態
- Required announcements navy section
- Announcement article：icon、title、priority badge、deadline、content、effective range
- Read confirmation button
- Empty / loading / error states

### /employee/handover

Figma frame name：`Employee / Handover`

主要模組：

- EmployeeShell
- 新增交接
- 交接清單
- 作者/時間/內容/狀態
- Empty / loading / error states

### /employee/shift

Figma frame name：`Employee / Shift`

主要模組：

- 班表狀態
- 今日班表
- 活動快訊
- 外部排班入口
- Empty / loading states

### /employee/more

Figma frame name：`Employee / More`

主要模組：

- 功能入口 grid
- 常用文件
- 場館快速連結
- 個人設定 / 更多操作

## 6. Supervisor Workbench Screens

### /supervisor

Figma frame name：`Supervisor / Dashboard`

主要模組：

- Layout controls：dashboard widget 開關
- KPI cards：當班人力、待審核異常、未完成交班、未確認公告、今日剩餘交接
- Staffing overview：圓形人力圖、現職/當班/未當班
- Pending anomalies list
- Incomplete tasks Top 5
- Quick actions grid：新增交班、指派交接、發布公告、交接紀錄、新增活動、異常審核
- Recent campaigns/activity

### /supervisor/tasks

Figma frame name：`Supervisor / Tasks`

主要模組：

- 任務篩選
- 任務 KPI
- 任務清單
- 任務詳情/狀態
- 指派、回報、完成管理

### /supervisor/announcements

Figma frame name：`Supervisor / Announcements`

主要模組：

- Summary cards：今日訊息、今日分析、待審核、已核准、已退回
- Search and filters：keyword、status select、apply
- Candidate list
- Candidate row：status、type、confidence、title、summary、facility/date
- Detail panel：AI 摘要、原始訊息、建議動作、適用對象、建議回覆
- Actions：核准公告、退回
- Error state：LINE Bot Assistant API unavailable

### /supervisor/anomalies

Figma frame name：`Supervisor / Anomalies`

主要模組：

- Metric cards：待處理、已處理、附件、通知收件者
- Search and segmented filter：待處理、已處理、全部
- Report list
- Report detail：employee、employee code、venue、role、clock status、clock type、clock time、distance
- Failure reason block
- Employee note block
- Full report text dark block
- Actions：標記已處理、改回待處理、刪除

### /supervisor/people

Figma frame name：`Supervisor / People`

主要模組：

- KPI cards：現職人員、目前當班、下一班
- People search card
- Staff lists：現職人員、目前當班、下一班人員
- Staff row：avatar、name、facility/department/timeRange、status badge
- Facility distribution cards

### /supervisor/handover

Figma frame name：`Supervisor / Handover`

主要模組：

- 交班建立
- 交班清單
- 狀態變更
- 指派與目標班別
- Empty / loading / error states

### /supervisor/reports

Figma frame name：`Supervisor / Reports`

主要模組：

- Metrics：在班人力、待審異常、未完成任務、未確認公告、UI 事件
- Event trend vertical bar chart
- Export button placeholder
- Top targets / popular actions ranking

### /supervisor/settings

Figma frame name：`Supervisor / Settings`

主要模組：

- Summary cards：快速入口、系統公告、目前場館
- Employee home widget layout editor
- Drag/drop widget rows
- Enable/disable controls
- Move up/down buttons
- Save/reset actions
- Preview skeleton
- Quick links list
- System announcements list
- Governance cards：權限邊界、版面設定、資料接口

## 7. System Governance Screens

### /system

Figma frame name：`System / Overview`

主要模組：

- Metric cards：system overview metrics
- Health score circle
- 24-hour health bar trend
- Incident list
- Integration failure list
- Quick tools grid：Raw Inspector、操作稽核查詢、整合監控、報表產生器、設定管理、使用者管理

### /system/alerts

Figma frame name：`System / Alerts`

主要模組：

- Metrics：告警事件、整合失敗、異常通報、健康狀態
- System alerts list：title、time、severity badge
- Anomaly report list：employee、context、venue
- DB not configured warning state

### /system/integrations

Figma frame name：`System / Integrations`

主要模組：

- Metrics：接口總數、已設定、正式模式、需處理
- Adapter Registry：adapter name、mode、configured/reserved state
- Last checked timestamp
- Refresh button
- Integration failure panel
- Empty success state

### /system/audit

Figma frame name：`System / Audit`

主要模組：

- Metrics：UI 事件、Client Errors、Portal Events、使用者
- Event type ranking
- High-frequency users ranking
- Empty states

### /system/raw-inspector

Figma frame name：`System / Raw Inspector`

主要模組：

- Query target card：icon、description、endpoint select、query button
- Raw JSON card：dark code panel
- Usage notice / telemetry note
- Loading / error states

## 8. Legacy Admin Screens

這些是舊管理端路由，仍要保留在 Figma 作為「Legacy / Admin」頁面群。

```text
/                       Legacy / Dashboard
/analytics              Legacy / Analytics
/operations             Legacy / Operations
/hr-audit               Legacy / HR Audit
/system-health          Legacy / System Health
/anomaly-reports        Legacy / Anomaly Reports
/announcements          Legacy / Announcement Review
/announcements/summary  Legacy / Announcement Summary
```

大型模組：

- AppSidebar
- Header title
- 營運戰情 KPI
- 決策數據圖表
- 跨館資源監控
- HR 稽核查詢
- 微服務健康監控
- 打卡異常管理
- 公告候選審核
- 公告分析總覽

## 9. States To Export

每個主要頁面至少建立以下 state frame：

```text
Default
Loading
Empty
Error
Permission denied / Redirect
Mobile
```

優先建立完整 state 的頁面：

- Portal / Facility Home
- Portal / Announcements
- Portal / Handover
- Employee / Home
- Employee / Tasks
- Supervisor / Announcements
- Supervisor / Anomalies
- System / Integrations
- System / Raw Inspector

## 10. Figma Component Naming

```text
Shell/PortalShell
Shell/EmployeeShell
Shell/RoleShell
Navigation/SidebarItem
Navigation/MobileBottomItem
Card/Bento/White
Card/Bento/Navy
Card/Workbench/Light
Card/Workbench/Navy
KPI/Card
List/AnnouncementRow
List/HandoverItem
List/TaskItem
List/AnomalyReportItem
Data/StatusBadge
Data/PriorityBadge
Data/HealthScoreCircle
Data/HeatmapTreemap
Form/SearchBar
Form/TextareaWithCounter
Form/QuickLinkEditor
Form/SystemAnnouncementEditor
State/LoadingSkeleton
State/Empty
State/Error
```

## 11. Redesign Priority

第一批母版：

```text
1. Portal / Facility Home / xinbei_pool
2. Employee / Home
3. Supervisor / Dashboard
4. Supervisor / Announcements
5. System / Overview
6. System / Raw Inspector
```

第二批延伸：

```text
1. Portal / Handover
2. Portal / Shift
3. Employee / Tasks
4. Supervisor / Anomalies
5. Supervisor / Settings
6. System / Integrations
```

第三批補齊：

```text
1. Portal / Campaigns
2. Portal / Analytics
3. Employee / Announcements
4. Employee / More
5. Supervisor / People
6. Supervisor / Reports
7. Legacy Admin screens
```
