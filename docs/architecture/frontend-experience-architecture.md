# 駿斯內部工作台前端體驗架構

版本：v0.1
日期：2026-04-24
狀態：暫定版，用於底層重構後續 UIUX 補齊

## 1. 目的

本文件補足目前前端技術架構未明確定義的部分。

此專案不是單純把既有頁面整理乾淨，而是要把泥球化的 Replit 全端專案，逐步重構成可長期演進的內部工作台。底層技術與資料邊界以 `技術架構.md` 為最高依據；本文件只定義前端體驗層如何承接。

核心目標：

1. 手機端要有接近 Behance / 高品質作品展示型產品的精緻度與流暢感。
2. 電腦端要有大型知名設計網站 / 高階 SaaS dashboard 的一致性、節奏與視覺品質。
3. 前端必須即時反映工作狀態，但不得把資料聚合與 fallback 壓回 component。
4. 功能模組可以透過 ReactKit / component kit 方式被展示、陳列與漸進替換。
5. UIUX 可以逐步補齊，但底層架構不能再增加泥球化程度。

## 2. 體驗定位

正式定位：

**Premium Operational Work Hub**

它不是行銷 landing page，也不是傳統後台表格，而是：

- 手機端：精緻、順滑、內容優先、像作品集 feed 一樣有層次。
- 桌機端：高一致性、資訊密度可控、像成熟 design system 驅動的 SaaS 工作台。
- 系統端：穩定、可查、可追、可 drill-down，不做過度裝飾。

設計方向不是炫技，而是讓「每天都會打開的內部工具」具備高品質產品感。

## 3. 前端技術選型

現況已有：

- React 18
- Vite
- TypeScript
- Wouter
- TanStack Query
- Tailwind CSS
- shadcn/Radix UI
- Framer Motion
- Recharts

重構目標：

| 類別 | 方向 | 說明 |
|---|---|---|
| Routing | TanStack Router | 依技術架構書，逐步從 Wouter 遷移；支援 route loaders、beforeLoad、typed search params |
| Server State | TanStack Query | 保留，負責 BFF DTO cache、invalidations、prefetch |
| UI Primitives | Radix / shadcn | 保留作可及性與基礎互動層 |
| Styling | Tailwind + design tokens | 不在 component 裡散落 raw color / arbitrary spacing |
| Motion | Framer Motion + CSS transitions | 用於 page transition、card reveal、sheet/modal、press feedback |
| Charts | Recharts 或後續替換 | System / dashboard 圖表先可用，後續可抽 chart adapter |
| Module Showcase | ReactKit / internal component kit | 用於模組陳列、卡片展示、狀態元件、互動 demo，不直接侵入資料層 |

## 4. ReactKit 使用原則

這裡的 ReactKit 先定義為「可插拔的 React component / interaction kit 層」。

採用原則：

1. ReactKit 只能用在 presentation layer，不可承擔資料取得、權限判斷或 BFF fallback。
2. 每個 ReactKit 元件必須包成專案內部 wrapper，例如 `client/src/shared/ui-kit/*`。
3. domain module 不直接依賴第三方 kit API，而是依賴內部 wrapper。
4. 若未來更換 ReactKit 或混用其他 component kit，只改 wrapper，不改 domain page。
5. ReactKit 適合用於：
   - bento / masonry module showcase
   - card transition
   - hover / press / reveal effect
   - animated tabs / segmented control
   - timeline / activity feed
   - empty state / skeleton / status display
6. ReactKit 不適合用於：
   - auth/session
   - BFF request
   - business state machine
   - audit / telemetry persistence
   - raw inspector data handling

在正式安裝任何 ReactKit 套件前，需先確認：

- bundle size
- tree-shaking
- accessibility
- Tailwind / CSS token 相容性
- reduced-motion 支援
- SSR / Vite 相容性
- license

## 5. 即時渲染策略

「即時渲染」不代表前端不斷輪詢所有 API，也不代表 component 自己拼資料。

正式策略：

1. 首頁首次載入讀單一 BFF page DTO。
2. 高頻 section 使用 projection / cache，BFF 回 `BffSection<T>`。
3. 前端用 TanStack Query 管理 server state。
4. 即時更新透過以下順序逐步導入：
   - query invalidation after mutation
   - background refetch on focus / reconnect
   - interval refetch only for必要區塊
   - SSE / WebSocket for notification、incident、task update
5. 即時事件只通知「哪個 query 要失效」，不把完整業務資料推給 component 自組。
6. 大列表或高頻 feed 必須 virtualize 或分頁。
7. 所有 skeleton、empty、stale、unavailable、degraded 狀態要設計成正式 UI，不是臨時錯誤文字。

## 6. 手機端設計規範

手機端目標：像 Behance 類型產品一樣有精美視覺節奏，但保留工作台效率。

手機端原則：

- Mobile-first layout，不是桌機縮小。
- 使用內容卡片、bento section、activity feed、底部導航或分段 navigation。
- 首屏只保留最重要的 1 到 3 個工作狀態。
- 次要資訊用 collapsible section、sheet、tabs 或 drill-down。
- 所有 touch target 至少 44px。
- 固定底部操作需避開 safe area。
- 不依賴 hover。
- page transition 與 card transition 必須順滑，但尊重 `prefers-reduced-motion`。
- 圖片、圖表、卡片要保留 aspect-ratio，避免 layout shift。
- 不允許 horizontal scroll。

手機端視覺語言：

- 高品質封面式卡片，但避免首頁變成圖片牆。
- 清楚的 typographic hierarchy。
- 精緻的 motion rhythm。
- 卡片間距與留白要有節奏。
- 狀態與 CTA 明確，不讓使用者猜下一步。

## 7. 電腦端設計規範

桌機端目標：像成熟設計網站與高階 SaaS dashboard 一樣一致、穩定、可掃描。

桌機端原則：

- 左側 navigation drawer / rail + 主內容區。
- 首頁使用 dashboard grid，但資訊密度可控。
- 每張卡只對應一個主題。
- 支援 drill-down、filter、search、批次操作。
- 表格、圖表、列表必須有 loading / empty / error / stale state。
- 同一功能在不同角色中保持視覺語言一致，但資訊優先順序不同。

桌機視覺語言：

- 高一致性 spacing scale。
- 明確 surface 層級，不做卡片套卡片。
- 使用 semantic color tokens，不靠大量漸層裝飾。
- icon 使用 lucide 或一致 icon family。
- data-heavy 區域使用 tabular numbers。
- 操作密度高，但不可犧牲可讀性。

## 8. Design Token 與 UI System

需要建立 token 層，而不是在頁面中各自寫樣式。

最小 token：

- color：surface、surface-muted、border、text、text-muted、primary、danger、warning、success、info
- typography：display、headline、title、body、label、mono
- spacing：4 / 8 / 12 / 16 / 24 / 32 / 48
- radius：4 / 6 / 8 / 12，工作台卡片預設不超過 8
- shadow：none / subtle / floating / overlay
- motion：duration-fast、duration-base、duration-slow、ease-standard、ease-emphasized
- z-index：base、dropdown、sticky、modal、toast

所有新元件必須使用 token，不直接散落不可管理的 raw values。

## 9. 前端模組邊界

目標結構：

```text
client/src/
  app/
    router/
    providers/
    layouts/
  modules/
    employee/
    supervisor/
    system/
  shared/
    api/
    auth/
    bff/
    telemetry/
    ui/
    ui-kit/
    motion/
    responsive/
```

規則：

- `modules/*` 只能組合 UI、hook、BFF query，不直接呼叫外部 API。
- `shared/api` 封裝 fetch client、error mapping、credentials、CSRF。
- `shared/bff` 放 BFF envelope parser 與 section helpers。
- `shared/ui-kit` 包 ReactKit / third-party visual components。
- `shared/telemetry` 放 `useTrackEvent()`。
- `shared/auth` 放 `/api/auth/me` query 與 route guard。

## 10. 舊前端遷移策略

現有高風險點與處理狀態：

- `use-bound-facility.ts` 用 localStorage 存 facility / auth：已改為讀 `/api/auth/me` cookie session，場館切換走 `/api/auth/active-facility`。
- `portalApi.ts` 在前端 fallback 拼 announcement / campaign。
- `App.tsx` 中 portal 與 admin route 混在一起。
- Wouter route 無 typed loader / beforeLoad。

遷移順序：

1. 先建立新 `/employee/*` route branch，不動舊 `/portal/*`。
2. 新 branch 全部走 BFF。
3. 建立 auth guard，但先可用 mock `/api/auth/me`。
4. 建立 employee home mock DTO。
5. 把舊 portal 的可用 component 逐步搬成 module widget。
6. 舊 portal 功能確認替代後，再退場 localStorage auth。（已完成 auth/facility truth 退場，theme preference 不在此範圍）

## 11. 前端驗收標準

每個新頁面至少驗收：

- 375px phone
- 768px tablet
- 1280px desktop
- 1440px desktop
- reduced-motion
- loading / empty / error / stale / unavailable
- keyboard navigation
- touch target
- no horizontal scroll
- no layout overlap
- no localStorage session / role / facility truth
- no direct external API call in component

## 12. 第一階段交付建議

第一階段不要追求完整 UIUX 定稿，先建立可長期承接精緻 UI 的技術底座。

交付物：

1. `shared/bff/envelope.ts`
2. `client/src/shared/bff/use-bff-section.ts`
3. `client/src/shared/api/client.ts`
4. `client/src/shared/auth/use-me.ts`
5. `client/src/shared/ui-kit/` wrapper scaffold
6. `client/src/shared/motion/tokens.ts`
7. `client/src/modules/employee/home/` mock 首頁
8. `GET /api/bff/employee/home` mock BFF
9. mobile / desktop responsive shell
10. Playwright 或手動 viewport QA checklist

明確不做：

- 不先重寫全部舊 portal。
- 不先追完整 Behance 等級視覺稿。
- 不先大量安裝 UI 特效套件。
- 不讓 ReactKit 直接滲透 domain logic。

## 13. 角色首頁落地狀態

目前根路由已從舊 DAOS / LINE Bot 全局藍圖切換為新 Workbench 角色首頁：

- `/`：登入後導向目前預設角色 `/system`。
- `/login`：全端開發測試登入，mock 帳密為 `1111 / 1111`。
- `/supervisor`、`/supervisor/home`：主管 / 管理控制台。
- `/system`、`/system/overview`：系統 / IT 治理台。
- `/employee`、`/employee/home`：員工行動工作台。

實作規則：

- 角色頁面共用 `client/src/modules/workbench/role-shell.tsx`，避免每個頁面各自複製 sidebar / mobile bottom nav。
- 主管與系統頁面只讀 BFF：`/api/bff/supervisor/dashboard`、`/api/bff/system/overview`。
- 同一個開發帳號預設 active role 為 `system`，可透過 `/api/auth/active-role` 切換 `employee` / `supervisor` / `system`。
- 主管首頁已加入版面控制，可開關 KPI、人力、異常、任務、快速操作、近期活動 widgets。
- Workbench route 已不再使用 `LegacyWorkbenchPage` 作為剩餘功能承接；舊 `/analytics`、`/operations` 等原 DAOS 後台 route 仍保留在非 workbench 入口。
- 手機底部導航已改為真實 route link，主管與系統角色分別對應各自核心入口，避免 mobile 只呈現不可導航的 icon button。
- `/supervisor/tasks` 已改為正式主管模組 `client/src/modules/supervisor/tasks`，先讀主管 BFF 任務投影，後續接任務 state machine。
- `/supervisor/handover` 已改為正式主管模組 `client/src/modules/supervisor/handover`，交接寫入由後端 session 強制作者身份。
- `/supervisor/settings` 已移除；主管端不再提供設定 / widget layout 編輯頁，quick links 與 announcements 改回各自正式模組治理。
- `/supervisor/reports` 已改為正式主管模組 `client/src/modules/supervisor/reports`，彙整 BFF 與 Portal analytics。
- `/supervisor/people` 已改為正式主管模組 `client/src/modules/supervisor/people`，前端只呼叫本平台 HR audit / interview-users API，體育署、Ragic、Smart Schedule 仍由後端代理。
- `/supervisor/announcements` 已改為正式主管模組 `client/src/modules/supervisor/announcements`，前端只呼叫本平台公告 API，保留 LINE Bot Assistant 代理與審核 mutation。
- `/supervisor/anomalies` 已改為正式主管模組 `client/src/modules/supervisor/anomalies`，前端只呼叫本平台異常通報 / 通知收件者 API，保留處理狀態與刪除 mutation。
- `/system/integrations` 已改為正式系統模組 `client/src/modules/system/integrations`，讀取 system integration BFF，不再由舊跨館資源頁直接打外部 Replit URL。
- `/system/alerts`、`/system/audit`、`/system/raw-inspector` 已改為正式系統模組，分別承接告警、稽核與白名單 raw JSON inspection。
- `/employee/tasks`、`/employee/announcements`、`/employee/handover`、`/employee/shift`、`/employee/more` 已改為正式員工端深連模組；手機底部導航與桌機側欄皆為真實 route link。
- 舊 `client/src/pages/dashboard.tsx` 與 `client/src/pages/system-health.tsx` 已轉為新角色頁 wrapper，避免第一張舊畫面從 legacy route 回流。
- 視覺上先對齊架構書與圖二的資訊架構、角色入口、響應式骨架；後續 UIUX 精修應只改 module widget / ui-kit，不反向破壞 BFF 邊界。

## 14. 目前 module 完成口徑

完成定義不是「畫面可開」，而是同時滿足：

1. 角色入口在 `/employee`、`/supervisor`、`/system` 內。
2. 前端 module 不直接呼叫外部 SaaS 或資料庫。
3. API 呼叫集中在 module `api.ts` 或 shared client。
4. 桌機與手機共用同一資料契約，僅調整 layout priority。
5. loading / empty / error / mutation busy state 有正式 UI。

已完成正式 module：

- `employee/home`：員工首頁 BFF DTO。
- `employee/tasks`：今日任務列表。
- `employee/announcements`：群組公告與必讀狀態。
- `employee/handover`：櫃台交接列表與新增。
- `employee/shift`：今日班表與活動檔期。
- `employee/more`：常用入口、文件與 Portal quick-links。
- `supervisor/dashboard`：主管首頁 BFF DTO 與版面控制。
- `supervisor/tasks`：主管任務投影與篩選。
- `supervisor/handover`：櫃台交接列表與新增。
- `supervisor/announcements`：公告候選池審核。
- `supervisor/anomalies`：打卡異常審核。
- `supervisor/people`：人員稽核與面試授權入口。
- `supervisor/settings`：已移除，不列入近期施工。
- `supervisor/reports`：主管報表分析。
- `system/overview`：系統健康、整合狀態與快速工具。
- `system/alerts`：系統告警中心。
- `system/audit`：操作稽核。
- `system/integrations`：外部 adapter registry 與整合失敗檢視。
- `system/raw-inspector`：白名單 raw JSON inspector。

Workbench 入口已完成目前規劃的正式 module 化；後續新增功能不得回到 legacy wrapper。
