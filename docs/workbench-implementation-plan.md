# 駿斯內部工作台開發規劃

版本：v0.1
日期：2026-04-24
適用 repo：`400qian-duan-yi-biao-ban`

相關文件：

- `技術架構.md`：底層架構與技術選型最高依據
- `駿斯_UIUX前端架構書_v1.md`：角色、首頁、模組與互動規則
- `docs/frontend-experience-architecture.md`：前端體驗、React 技術層、即時渲染、ReactKit / component kit 使用規則
- `docs/backend-foundation-map.md`：後端底層架構邊界與 module / adapter map
- `docs/replit-reconnect-guide.md`：Replit pull 後資料接口重連規則

## 1. 現況判定

本 repo 目前不是空專案，而是既有 Replit 風格整合型全端應用。

現況重點：

- 前端：React 18、Vite、Wouter、TanStack Query、Tailwind、shadcn/Radix UI。
- 後端：Express、單一 `server/routes.ts` 集中註冊多數 API。
- 資料層：Drizzle schema 已集中在 `shared/schema.ts`。
- 現有模組：打卡異常、公告候選、Portal 首頁、交接、quick-links、system announcements、portal events。
- 現有風險：前端仍有 localStorage session / facility、前端 fallback 拼裝、多來源資料組合、後端路由過度集中、本機 `uploads/` / `exports/` 依賴。

因此本專案採用 strangler-style 漸進重構，不推翻重寫。新工作台能力走新架構，既有功能被碰到時逐步遷入新邊界。

## 2. 不可退讓原則

1. 明確前後端切割：前端只呼叫 BFF / 本平台 API，不直接接外部來源或資料庫。
2. 桌機與手機共同適應：同一 BFF DTO 支援不同 viewport，不分裂業務邏輯。
3. 資料處理方式明確：外部來源走 Adapter，資料庫走 Repository，首頁走 BFF envelope。
4. 前端不過載：首頁只做 summary + CTA + drill-down，不在 component 裡 map/filter/reduce 拼業務頁面。
5. 保留擴充彈性：所有正式來源先以 interface 保留，可先接 mock / test data，Replit 階段再重連 real adapter。
6. Replit 是開發 / 驗證環境，不是架構邊界；未來 WordPress / VPS 部署仍維持 static frontend + Node BFF + PostgreSQL + Redis + Object Storage。

## 3. 建議目標結構

短期先維持現有目錄名稱，避免一次性大搬家：

```text
client/
  src/
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
      telemetry/
      ui/
server/
  app/
    http/
    config/
    container/
  modules/
    auth/
    bff/
    announcements/
    tasks/
    handover/
    anomalies/
    quick-links/
    notifications/
    telemetry/
    system/
  integrations/
    ragic/
    schedule/
    booking/
    mail/
    storage/
  shared/
    db/
    cache/
    security/
    errors/
shared/
  bff/
  auth/
  domain/
  integrations/
```

說明：

- 先不強制改成 `frontend/` / `backend/` workspace，因為現有專案已使用 `client/` / `server/`。
- 若未來要正式拆 workspace，再做第二階段搬遷。
- 第一階段重點是建立模組邊界與契約，不是改資料夾名稱。

## 4. Phase 0：規格落地與契約先行

目標：先讓代理與開發者有一致邊界。

工作項目：

- 建立 ADR：
  - 多角色 session
  - campaigns-events 雙來源
  - BFF section envelope
  - notification priority policy
  - deployment portability
  - responsive single-contract
  - adapter-first test data
- 建立 shared 契約：
  - `BffSection<T>`
  - `AuthMeDto`
  - `Role` / `Facility`
  - `EmployeeHomeDto`
  - `SupervisorDashboardDto`
  - `SystemOverviewDto`
- 建立 `.env.example`：
  - `DATA_SOURCE_MODE`
  - `DATABASE_PROFILE`
  - `SCHEDULE_ADAPTER_MODE`
  - `BOOKING_ADAPTER_MODE`
  - `RAGIC_ADAPTER_MODE`
  - `REDIS_URL`
  - `OBJECT_STORAGE_*`

驗收：

- 前後端都從 `shared/` import DTO。
- 新 BFF response 都回 `BffSection<T>`。
- 不新增直接外部 API 呼叫到前端。

## 5. Phase 1：後端邊界先切開

目標：讓 `server/routes.ts` 變薄，建立可擴充的模組化單體。

優先順序：

1. 建立 `server/app/http/register-routes.ts` 作新路由入口。
2. 建立 `server/shared/bff/section.ts`，提供 `ok/stale/unavailable/degraded`。
3. 建立 `server/shared/db/profile.ts`，讓 local/test/neon 可用 env 切換。
4. 建立 `server/integrations/*` adapter interface 與 mock adapter。
5. 建立 `server/shared/storage/StorageAdapter`，先包住目前 `uploads/` 寫法。
6. 新 API 一律放進 `server/modules/*`，舊 `server/routes.ts` 只保留 legacy route。

第一批要切出的模組：

- `auth`
- `bff`
- `telemetry`
- `handover`
- `quick-links`
- `announcements`

驗收：

- `server/routes.ts` 不再新增新功能。
- mock mode 下 employee home BFF 可回完整 DTO。
- external adapter 掛掉時 BFF 回 envelope fallback，不回 500。

## 6. Phase 2：Auth / Session 收權

目標：移除 portal localStorage auth 真相，改由後端 session 裁定。

工作項目：

- 實作 Redis session store。
- Cookie 只存 opaque `session_id`。
- `/api/auth/me` 回：
  - `userId`
  - `grantedRoles`
  - `activeRole`
  - `grantedFacilities`
  - `activeFacility`
  - `permissionsSnapshot`
- 實作 `POST /api/auth/active-facility`。
- 不提供 `POST /api/auth/active-role`。
- 加 Origin / CSRF 防護。

前端調整：

- 停用 `portalAuth` localStorage 作 session 真相。
- `facilityKey` 從 `/api/auth/me` 取得，切館走後端 API。
- route guard 從 localStorage 改成 auth query。

驗收：

- 清掉 Redis session 後下次請求回 401。
- DevTools localStorage 不含 token/session/role 真相。
- 非授權館別切換回 403。

## 7. Phase 3：首頁 BFF 與不過載前端

目標：先做三角色首頁骨架，讓 UI 不再自行聚合資料。

建議 BFF：

- `GET /api/bff/employee/home`
- `GET /api/bff/supervisor/dashboard`
- `GET /api/bff/system/overview`

Employee home section：

- tasks
- announcements
- handover
- bookingSnapshot
- shiftReminder
- quickLinks
- personalNote
- qna

Supervisor dashboard section：

- staffing
- pendingAnomalies
- incompleteTasks
- announcementAcks
- handoverOverview
- quickLinkManagement

System overview section：

- health
- incidents
- integrationFailures
- auditOverview
- uiEventOverview

驗收：

- 首頁元件只 consume DTO，不自行打多個 API 拼資料。
- desktop 與 mobile viewport 都可操作核心 CTA。
- section status 為 `unavailable/stale/degraded` 時都有明確 UI。

## 8. Phase 4：Telemetry / Audit 分層

目標：先把事件收集與稽核邊界建立起來。

工作項目：

- 建立 `ui_events`。
- 建立 `audit_logs`。
- `POST /api/telemetry/ui-events` 回 202，不阻塞 UI。
- `POST /api/telemetry/client-error`。
- 建立 `writeAudit()` helper。
- raw inspector 與所有高權限操作必寫 audit。
- 任務狀態、公告發布、異常審核等 business write 要有 audit 或 domain event。

驗收：

- 點擊首頁卡片會寫 ui event。
- 發布公告 / 審核異常 / raw inspector 查詢會寫 audit。
- telemetry API 有 rate limit。

## 9. Phase 5：核心模組迭代順序

建議開發順序：

1. `announcements`
2. `handover`
3. `quick-links`
4. `tasks`
5. `anomalies`
6. `booking-snapshot`
7. `shift-reminder`
8. `campaigns-events`
9. `notification-center`
10. `knowledge-base-qna`
11. `personal-note`
12. `system raw inspector`

理由：

- announcements / handover / quick-links 已有現有資料與 UI，可最快收斂成新架構。
- tasks 是首頁核心，但現況資料模型較少，需先補 schema。
- booking / shift / campaigns 屬外部 adapter，先 mock 後 real。
- notification 必須等事件與核心 domain 有基本生命週期再做。

## 10. Phase 6：部署路徑

Replit 階段：

- 同 repo 跑 full-stack validation。
- 使用 mock/test adapter 先完成 UI / BFF / telemetry。
- 再逐一把 adapter mode 改成 real。

VPS 階段：

- 前端 build 成 static assets。
- 後端用 Node process / Docker / systemd 跑 API。
- PostgreSQL / Redis / Object Storage 外部化。
- `/api/*` 指到 backend，`/workbench/*` 指到 frontend。

WordPress 階段：

- WordPress 只做入口、內容頁、導流或 reverse proxy。
- 工作台本體不寫成 WordPress plugin。
- session、BFF、權限、資料真相仍在 Node backend。

## 11. 近期第一個 Sprint 建議

Sprint 1 只做架構基線，不急著做完整功能或完整視覺稿。

交付物：

- ADR 七份。
- `.env.example`。
- `shared/bff/envelope.ts`。
- `shared/auth/me.ts`。
- `server/shared/bff/section.ts`。
- `server/shared/db/profile.ts`。
- `server/integrations/*/adapter` 範例一組。
- `GET /api/bff/employee/home` mock DTO。
- `client/src/shared/api/client.ts`。
- `client/src/shared/ui-kit/` wrapper scaffold，預留 ReactKit / component kit 接入。
- `client/src/shared/motion/` motion tokens。
- 前端 `/employee` mock 首頁 consume 單一 BFF，先驗證手機 / 桌機 responsive shell。

不做：

- 不先大搬家成 monorepo workspace。
- 不先重寫所有 existing portal pages。
- 不先接全部正式外部 API。
- 不先做完整 notification-center。
- 不讓 ReactKit 或任何 UI kit 直接承擔資料取得、權限判斷或 BFF fallback。

## 12. 目前需優先處理的技術債

1. `client/src/lib/portalApi.ts` 仍有部分前端 fallback 拼 announcements / campaigns，下一階段應收斂到 BFF section。
2. `server/routes.ts` 仍是 legacy route 聚合點，已支援 cookie session caller，但後續應逐步移到 `server/modules/*`。
3. `server/routes.ts` CORS 目前使用 `Access-Control-Allow-Origin: *`，正式 cookie session / VPS 部署前不可沿用。
4. `uploads/` 與 `exports/` 是本機持久層風險，需用 StorageAdapter 包起來。
5. `shared/schema.ts` 已開始承擔多 domain schema，後續需拆成 domain schema barrel export。
6. `Raw Inspector` 已完成白名單與 UI module 化，尚待補 server-side audit log。

## 13. 2026-04-24 落地進度

已落地：

- 三角色工作台入口：`/employee`、`/supervisor`、`/system`。
- 員工端正式深連入口：`/employee/tasks`、`/employee/announcements`、`/employee/handover`、`/employee/shift`、`/employee/more`。
- 全端開發測試登入：`1111 / 1111`，預設 active role 為 `system`，可切換 `employee` / `supervisor` / `system`。
- BFF 基線：`/api/bff/employee/home`、`/api/bff/supervisor/dashboard`、`/api/bff/system/overview`。
- 外部資料來源保留與可切換 adapter：Ragic、LINE Bot Assistant、Smart Schedule Manager。
- 場館與 LINE 群組 ID 對照常數集中於 shared domain，不散落在 UI。
- 主管首頁支援版面控制，widget 可開關。
- 手機底部導航已從純按鈕改為真實 route link，支援主管 / 系統角色核心入口切換。
- `/supervisor/tasks` 已從 legacy wrapper 遷成正式主管 module。
- `/supervisor/announcements` 已從 legacy wrapper 遷成正式主管 module。
- `/supervisor/anomalies` 已從 legacy wrapper 遷成正式主管 module。
- `/supervisor/people` 已從 legacy wrapper 遷成正式主管 module。
- `/supervisor/handover` 已從 legacy wrapper 遷成正式主管 module，使用 Portal handovers API。
- `/supervisor/settings` 已移除；主管端不再提供半成品設定頁，quick-links / system announcements 留在各自模組與 legacy portal 管理面。
- `/supervisor/reports` 已新增正式主管 module，彙整 Supervisor BFF、Portal analytics、System overview。
- `/system/alerts` 已從 legacy wrapper 遷成正式系統 module，彙整 System overview 與 anomaly reports。
- `/system/audit` 已新增正式系統 module，讀取 UI event overview 與 Portal analytics。
- `/system/integrations` 已從 legacy wrapper 遷成正式系統 module。
- `/system/raw-inspector` 已從 legacy wrapper 遷成正式系統 module，限制白名單 endpoint。
- Portal localStorage session / facility 真相已退場，登入、切館與 route guard 改由 `/api/auth/me` cookie session 裁定。
- Workbench 共用 UI token / card / shell 已依外部 web-design-skill 改善 hover、focus、reduced-motion、container query 與手機底部導航狀態。
- Replit 外接資料接線文件已新增：`docs/replit-external-data-connection.md`。
- shared API client 已補齊 `GET` / `POST` / `PATCH` / `DELETE`，供 module mutation 使用。

下一批遷移順序：

1. `portalApi` remaining fallback：將公告 / campaigns fallback 移入 BFF。
2. `server/modules/*` extraction：把 alerts、audit、handover、reports 的 route 實作逐步移出 `server/routes.ts`。
3. `StorageAdapter`：包住 uploads / exports，保留 Replit / VPS / object storage 替換能力。
4. `Audit log write path`：Raw Inspector、公告審核、異常審核與主管 domain writes 補 server-side audit；主管設定頁已移除，不再列入 audit 接線範圍。
5. `CORS / CSRF hardening`：正式部署前改為白名單 origin 與 cookie session 防護。

目前完成口徑：

- 底層架構與兩份主要架構書指定的工作台主路由已完成 module 化。
- 前端工作台已不再依賴 legacy wrapper 作主要頁面；剩餘技術債集中在 server route 抽薄、BFF fallback 收斂、持久層 adapter 與正式部署安全。
