# 400Qian-Duan-Yi-Biao-Ban 架構書骨架

最後更新：2026-04-23  
適用目的：後續完整架構書撰寫、模組盤點、系統擴充、重構前評估

## 1. 專案定位

此 repo 不是單一「班表頁面」，而是同時承載以下 4 類能力：

1. 管理端營運後台
2. 員工 Portal 入口
3. 本地資料與附件儲存服務
4. 外部系統整合與 proxy 層

目前系統核心技術為：

- Frontend: React 18 + TypeScript + Vite + Wouter + TanStack Query
- UI: Tailwind CSS + shadcn/ui + Radix UI + Framer Motion
- Backend: Express 5 + Node HTTP Server
- Data: PostgreSQL + Drizzle ORM
- Integration: LINE Bot Assistant、Smart Schedule Manager、Ragic、Gmail SMTP

## 2. 實際專案結構

```text
400qian-duan-yi-biao-ban/
├─ client/
│  ├─ public/
│  │  └─ favicon.png
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ portal/
│  │  │  └─ ui/
│  │  ├─ config/
│  │  │  └─ facility-configs.ts
│  │  ├─ hooks/
│  │  │  ├─ use-bound-facility.ts
│  │  │  ├─ usePortalData.ts
│  │  │  └─ usePortalHome.ts
│  │  ├─ lib/
│  │  │  ├─ portalApi.ts
│  │  │  └─ queryClient.ts
│  │  ├─ pages/
│  │  │  ├─ portal/
│  │  │  ├─ analytics.tsx
│  │  │  ├─ announcement-summary.tsx
│  │  │  ├─ announcements.tsx
│  │  │  ├─ anomaly-reports.tsx
│  │  │  ├─ dashboard.tsx
│  │  │  ├─ hr-audit.tsx
│  │  │  ├─ operations.tsx
│  │  │  └─ system-health.tsx
│  │  ├─ types/
│  │  │  ├─ announcement.ts
│  │  │  └─ portal.ts
│  │  ├─ App.tsx
│  │  ├─ index.css
│  │  └─ main.tsx
│  └─ index.html
├─ server/
│  ├─ db.ts
│  ├─ index.ts
│  ├─ routes.ts
│  ├─ static.ts
│  ├─ storage.ts
│  └─ vite.ts
├─ shared/
│  └─ schema.ts
├─ docs/
│  ├─ anomaly-reports-architecture.md
│  ├─ frontend-source-code.md
│  ├─ functional-design-document.md
│  ├─ functional-design-document (copy).md
│  ├─ migration-guide.md
│  └─ architecture-book-outline.md
├─ script/
│  └─ build.ts
├─ design-refs/
├─ attached_assets/
├─ exports/
├─ uploads/
├─ package.json
├─ drizzle.config.ts
├─ tailwind.config.ts
├─ vite.config.ts
├─ tsconfig.json
├─ DESIGN.md
├─ SYSTEM_FULL_MAP.md
└─ replit.md
```

## 3. 模組責任切分

### 3.1 `client/`

前端 React 應用。實際上內含兩套使用情境：

- 管理端後台
- 員工 Portal

其中 [App.tsx](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/client/src/App.tsx:1) 是總入口，依 URL 是否為 `/portal` 開頭，切換到不同路由與佈局。

### 3.2 `server/`

後端 Express 應用，負責：

- 本地資料 CRUD
- 外部系統 proxy
- Ragic 登入驗證
- Gmail 郵件通知
- 圖片上傳與靜態檔服務
- 開發模式 Vite middleware
- 正式模式前端靜態檔託管

關鍵檔案：

- [index.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/server/index.ts:1): 啟動入口
- [routes.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/server/routes.ts:1): API 與整合邏輯
- [storage.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/server/storage.ts:1): 資料存取層
- [db.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/server/db.ts:1): Drizzle/DB 連線

### 3.3 `shared/`

共用資料結構層，主要是 [schema.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/shared/schema.ts:1)。

用途：

- Drizzle table schema
- insert schema validation
- 前後端共享型別邊界

### 3.4 `docs/`

現有設計文件區。建議後續角色如下：

- `functional-design-document.md`: 功能設計
- `architecture-book-outline.md`: 架構總覽與擴寫骨架
- `migration-guide.md`: 重構與資料搬遷策略
- `anomaly-reports-architecture.md`: 子模組專文

## 4. 執行架構

```text
Browser
├─ Admin Dashboard
│  ├─ 部分頁面直接打外部 API
│  └─ 部分頁面透過本地 Express API
└─ Employee Portal
   ├─ 讀取本地 Express API
   ├─ 由 Express 再 proxy 到外部服務
   └─ 讀取 localStorage 中的登入與館別綁定資訊

Express Server
├─ 業務 API
├─ Portal API
├─ Proxy API
├─ Auth API
├─ Upload / Export
└─ Static Hosting

PostgreSQL
├─ anomaly_reports
├─ notification_recipients
├─ handover_entries
├─ quick_links
├─ system_announcements
└─ portal_events

External Systems
├─ LINE Bot Assistant
├─ Smart Schedule Manager
├─ Ragic
└─ Gmail SMTP
```

## 5. 前端架構

### 5.1 管理端路由

管理端主要頁面：

- `/`: Dashboard
- `/analytics`: 決策與數據洞察
- `/operations`: 跨館資源監控
- `/hr-audit`: HR 稽核
- `/system-health`: 系統健康檢查
- `/anomaly-reports`: 打卡異常管理
- `/announcements`: 公告審核中心
- `/announcements/summary`: 公告分析總覽

### 5.2 Portal 路由

Portal 頁面集中於 `client/src/pages/portal/`：

- `/portal/login`
- `/portal`
- `/portal/:facilityKey`
- `/portal/:facilityKey/announcements`
- `/portal/:facilityKey/announcements/:id`
- `/portal/:facilityKey/handover`
- `/portal/:facilityKey/campaigns`
- `/portal/:facilityKey/shift`
- `/portal/:facilityKey/manage`
- `/portal/:facilityKey/analytics`
- `/portal/:facilityKey/review`

### 5.3 前端狀態與資料取得

資料流核心在：

- [queryClient.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/client/src/lib/queryClient.ts:1): fetch 包裝與 React Query 設定
- [usePortalData.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/client/src/hooks/usePortalData.ts:1): Portal 本地資料操作
- [portalApi.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/client/src/lib/portalApi.ts:1): Portal 首頁與公告資料聚合
- [use-bound-facility.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/client/src/hooks/use-bound-facility.ts:1): `portalAuth` 與 `facilityKey` 綁定

目前前端重要現況：

- 管理端資料來源並未完全統一
- Portal 驗證主要依賴 localStorage
- Portal 事件追蹤有 header，但其他 Portal 寫入 API 未統一帶入身份資訊

### 5.4 大模組盤點（員工端）

以下以「格式 `/員工/...`」列出。  
`/xinbei_pool` 與 `/salu_counter`、`/songshan_pool`、`/sanmin_pool` 使用同構頁面，僅資料域差異。

- /員工/portal/login：Ragic 登入（POST `/api/auth/ragic-login`）＋登入狀態（portalAuth）寫入
- /員工/portal：未綁定場館分流到場館選擇頁（`portal-setup`）
- /員工/portal/xinbei_pool：員工首頁（今日值班、交接摘要、快速入口、公告摘要）
- /員工/portal/xinbei_pool/announcements：群組公告列表、篩選、抽屜預覽
- /員工/portal/xinbei_pool/announcements/:id：公告詳情、既有內容查看、已讀回報（ack）
- /員工/portal/xinbei_pool/handover：交接事項新增、列表、刪除（Supervisor 可見）
- /員工/portal/xinbei_pool/campaigns：活動檔期卡片、時間窗口展示、分類條件
- /員工/portal/xinbei_pool/shift：值班與今日班表查詢、回報異常入口
- /員工/portal/xinbei_pool/manage：常用網址／系統公告維護（主管）
- /員工/portal/xinbei_pool/review：公告審核（管理端審核嵌入入口，主管）
- /員工/portal/xinbei_pool/analytics：交接與點擊行為分析（主管）

共用模組（員工端）：

- `PortalShell`：頁首、導覽、全域 header 與事件回報
- `PortalHome`、`PortalAnnouncements`、`PortalAnnouncementDetail`、`PortalHandover`、`PortalCampaigns`、`PortalShift`、`PortalManage`、`PortalReview`、`PortalAnalytics`
- `usePortalAuth` / `useBoundFacility`：登入與場館綁定
- `usePortalHome` / `usePortalData`：公告、交接、快速連結、分析資料鉤子
- `portalApi.ts`：首頁/公告/班表/交接抽象 API

### 5.5 大模組盤點（IT端）

以下以「格式 `/IT端/...`」列出。

- /IT端/：Dashboard 戰情總覽（KPI、全域摘要、任務追蹤）
- /IT端/analytics：數據洞察（歷史任務、完成率、日維度分析）
- /IT端/operations：跨館自動化監控（場館資源健康）
- /IT端/hr-audit：HR/員工查詢與稽核報表
- /IT端/system-health：後端服務健康狀態檢查
- /IT端/anomaly-reports：異常打卡資料清冊 + 通知收件者管理 + SMTP 測試
- /IT端/announcements：公告候選池審核（條件篩選、核准/退回）
- /IT端/announcements/summary：公告效能摘要（KPI、週報圖）

共用模組（IT端）：

- `App.tsx`：路由總控（Admin + Portal 入口切換）
- `AppSidebar`：左側導覽與分組頁籤
- `QueryClient` / `queryClient` / `apiRequest`：前端資料快取與 API 封裝
- `useQuery` / `useMutation`：CRUD、審核、通知、分析查詢
- UI：`dashboard.tsx`、`analytics.tsx`、`operations.tsx`、`hr-audit.tsx`、`system-health.tsx`、`anomaly-reports.tsx`、`announcements.tsx`、`announcement-summary.tsx`

## 6. 後端架構

### 6.1 API 類型

[routes.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/server/routes.ts:1) 目前同時承載：

- 異常打卡 API
- 通知收件者 API
- Portal handover / quick link / system announcement / analytics API
- Ragic 登入 API
- HR audit placeholder API
- LINE Bot Assistant proxy
- Smart Schedule Manager proxy
- 匯出檔案 API

### 6.2 Storage Layer

[storage.ts](/D:/駿斯工作內容/02-repos/400qian-duan-yi-biao-ban/server/storage.ts:1) 已形成簡單 repository 風格的存取層，這是後續拆 service 的切入點。

目前責任包含：

- anomaly report CRUD
- notification recipient CRUD
- handover CRUD
- quick link CRUD
- system announcement CRUD
- portal event analytics

### 6.3 Build / Runtime

`package.json` 目前腳本：

- `npm run dev`: `tsx server/index.ts`
- `npm run build`: `tsx script/build.ts`
- `npm run start`: 啟動 `dist/index.cjs`
- `npm run check`: TypeScript 型別檢查
- `npm run db:push`: Drizzle schema push

## 7. 資料模型

目前本地資料表：

| Table | 用途 |
|---|---|
| `users` | 舊式帳密資料，現況偏 legacy |
| `anomaly_reports` | 打卡異常主資料 |
| `notification_recipients` | 異常通知收件者 |
| `handover_entries` | Portal 交接事項 |
| `quick_links` | Portal 常用網址 |
| `system_announcements` | Portal 系統公告 |
| `portal_events` | Portal 操作與分析事件 |

建議在正式架構書中補充：

- 每張表欄位說明
- 與頁面/功能的對應關係
- 寫入來源與讀取來源
- 保留策略與資料生命週期

## 8. 外部整合版圖

### 8.1 LINE Bot Assistant

用途：

- Dashboard / Analytics / Operations 主要資料來源
- 公告候選與審核
- Facility home / 公告 / 今日班表 / 已讀回報

### 8.2 Smart Schedule Manager

用途：

- 異常打卡外部資料補充
- admin overview / interview users proxy

### 8.3 Ragic

用途：

- 員工登入驗證
- 身分與主管權限判定

### 8.4 Gmail

用途：

- 異常打卡新件通知
- 處理結果通知
- 測試郵件

## 9. 關鍵資料流

### Flow A: 異常打卡

1. 外部系統呼叫 `/api/anomaly-report`
2. Express 接收 JSON 或 multipart/form-data
3. 圖片進 `uploads/anomaly-reports/`
4. 報告內容寫入 `anomaly_reports`
5. 依設定寄發 Gmail 通知
6. 管理端頁面讀取本地與外部異常資料合併結果

### Flow B: Portal 登入

1. 使用者在 `/portal/login` 輸入員工編號與手機
2. 後端呼叫 Ragic 驗證
3. 回傳員工身份與主管權限
4. 前端將登入狀態存入 localStorage
5. 使用者導向指定館別 Portal

### Flow C: Portal 首頁

1. 前端依 `facilityKey` 找到館別設定
2. 讀取 `/api/facility-home/:groupId/home`
3. 同步載入 quick links 與 system announcements
4. 若上游缺資料，使用 fallback 邏輯補足公告類內容

### Flow D: Portal 交接與主管維護

1. 使用者在 Portal 進行交接新增或主管設定
2. 後端要求身份資訊判定 `requireEmployee()` / `requireSupervisor()`
3. 寫入本地 PostgreSQL
4. 部分操作會額外寫入 `portal_events`

## 10. 已知架構風險

這些點應列入正式架構書的「限制與技術債」章節：

1. 管理端資料來源分裂
   部分頁面直接打外部 API，部分透過本地 proxy，部署與錯誤處理策略不一致。

2. Portal 寫入權限鏈不一致
   後端 `requireEmployee()` / `requireSupervisor()` 需要身份資訊，但前端 `apiRequest()` 預設沒有補 `x-employee-number` 等 header。

3. Portal 首頁與本地 handover 資料未完全整合
   首頁 handover 與交接頁寫入來源不一致，容易造成使用者認知落差。

4. `users` / session / passport 為 legacy 殘留
   與現行 Ragic + localStorage 驗證模式並存，邊界不清。

5. 缺少 migration 與測試保護
   `drizzle.config.ts` 指向 migrations，但 repo 尚未建立對應 migration 流程。

## 11. 建議的架構書章節

建議你後續完整架構書照這個順序展開：

1. 系統背景與目標
2. 角色與使用情境
3. 系統邊界與上下游
4. 技術選型與原因
5. 專案目錄結構
6. 前端架構
7. 後端架構
8. 資料模型與資料生命週期
9. API 分層與外部整合
10. 權限與身份驗證
11. 部署方式與執行環境
12. 監控、記錄與告警
13. 已知限制與技術債
14. 擴充策略與重構藍圖
15. 附錄：路由表、資料表、環境變數、外部 API 清單

## 12. 擴充優先順序建議

如果你接下來要邊寫架構書邊擴功能，建議順序：

1. 先統一 Portal 身分傳遞與授權模型
2. 再統一管理端資料來源策略
3. 補齊 handover / homepage 的資料一致性
4. 建立 migration 流程
5. 補 `test` / smoke check
6. 最後再做新館別、新模組、新報表擴充

## 13. GitHub 連結資訊

預計連結的 remote：

- `origin`: `https://github.com/DAOS-Sport/400Qian-Duan-Yi-Biao-Ban.git`

正式連結完成後，建議在後續文件補充：

- branch strategy
- PR / release flow
- 文件維護責任人
- commit / tag 規則
