# 駿斯 CMS 上線前 Audit Report
日期：2026-05-14
執行時間：2026-05-15 Asia/Taipei
範圍：首頁 dashboard、任務管理、群組公告、櫃台交接、活動檔期 / 課程快訊、常用文件、員工教材、個人工作貼、失物招領、場地預約、相關問題詢問；角色 `/EMPLOYEE`、`/LIFEGUARD`、`/SUPERVISOR`、`/SYSTEM`；模組註冊、路由、API/BFF、DB schema、環境變數、外部整合、audit trail、loading/error/empty states、i18n/encoding。

## Executive Summary
- 嚴重問題（🔴）：7 件
- 一般問題（⚠）：14 件
- 通過項目（✅）：11 件
- 推薦上線時間：不建議直接上線。至少修完 🔴-001 ~ 🔴-005 後再做 Replit/prod smoke；🔴-006 ~ 🔴-007 可視上線範圍決定是否擋。

本次 `npm run dry-run`、`npm run check:modules`、`npm run check:workbench-governance`、`npm run check:announcement-classifier`、`npm run unit:modules` 均通過。這代表型別、註冊表基本契約與目前自動測試是綠的；但 Browser 與 DB 實查仍發現正式 CMS 使用會誤導或斷線的問題。

## 嚴重問題清單（🔴，必修才能上線）
### 🔴-001 員工任務管理頁仍顯示錯誤標題
- 模組：任務管理 / i18n
- 維度：路由與頁面一致性、編碼
- 現況：Browser 開 `/employee/tasks` 可見頁面 title 為錯誤交班標題；原始碼在 `client/src/modules/employee/tasks/page.tsx:231`。
- 影響：員工會把「任務管理」誤認成「交班事項」，且亂碼代表字元來源或 copy 流程仍未收斂。
- 建議：修正 title/source copy，並把 encoding artifact grep 加入 pre-launch gate。
- 預估修復時間：0.5 小時。

### 🔴-002 群組公告真入口未證明有資料落地
- 模組：群組公告 / Classifier
- 維度：資料流、外部依賴、DB
- 現況：Neon schema 有 `announcement_candidates.source_message_ids` 與 `classifier_anomalies`，但 DB 實查 `announcement_candidates=0`、`classifier_anomalies=0`、`ANNOUNCEMENT_CANDIDATES_WITH_SOURCE_IDS=0`。`check:announcement-classifier` 只驗證本地規則與 buffer，未證明 LINE webhook 真入口寫入。
- 影響：公告審核、must_read 分類、title/summary fallback、messageBuffer 都可能只停在 code/schema 層，無法支撐上線。
- 建議：用真 LINE webhook 或 replay job 寫入一批 fixture，驗證 candidates、source_message_ids、classifier_anomalies、audit row 全部有資料。
- 預估修復時間：0.5 ~ 1 天。

### 🔴-003 公告候選審核仍走 LINE Bot proxy，和本地 Neon candidates 脫節
- 模組：群組公告 / 公告管理
- 維度：API / BFF 鏈路
- 現況：`/api/announcement-candidates`、approve/reject、weekly report 仍 proxy 到 `LINE_BOT_BASE`；本地 DB 新表沒有被這些列表/審核路由作為 source of truth（`server/routes.ts:1039-1067`）。
- 影響：即使 Neon 有 `announcement_candidates`，主管審核頁仍可能讀外部服務；會出現「DB 有資料但 UI 沒資料」或「UI 有資料但本地 audit/schema 沒資料」。
- 建議：決定公告候選 source of truth；若上線版以 Neon 為準，補本地 BFF/CRUD/audit；若仍以 LINE Bot 為準，報告中要明確標示這不是 CMS 自主管理資料。
- 預估修復時間：1 ~ 2 天。

### 🔴-004 員工首頁 fallback facility key 與權限館別不一致，造成 403
- 模組：個人工作貼、相關問題詢問、首頁資料流
- 維度：跨館資料、權限、資料流
- 現況：Neon 與 session 使用 `xinbei_pool`；但 employee home fallback 回傳 `xinbei-high-school`（`server/modules/bff/employee-home.ts:16`）。Browser 實測 `/employee/personal-note` 打 `/api/portal/employee-resources?facilityKey=xinbei-high-school...` 回 403；`/employee/qna` 同樣回 403。
- 影響：員工看得到模組但資料讀不到，會被誤判成「尚未新增」而不是「館別 key 錯誤」。
- 建議：統一 facility key canonical map；禁止 BFF fallback 回傳 registry/session 不認得的 key。
- 預估修復時間：0.5 ~ 1 天。

### 🔴-005 System 多個 BFF / telemetry 讀取端點未登入也能讀
- 模組：System / IT 視角
- 維度：權限、資料安全
- 現況：未登入抽查：`/api/bff/system/health-overview`、`/integration-overview`、`/watchdog-events`、`/schedule-snapshot`、`/api/bff/system/ui-event-overview`、`/api/telemetry/module-events` 均回 200；只有 `/api/bff/system/control-center` 與 `/api/audit/logs` 回 401。對應 routes 在 `server/modules/system/routes.ts:583-621`、`807-813`、`server/modules/telemetry/routes.ts:58-63`。
- 影響：IT 監控、使用行為、整合狀態可能對未登入訪客公開；這不符合 system-only 視角。
- 建議：除 webhook ingestion 類端點外，system BFF 全部加 `requireSession + requireRole("system")`；外部 watchdog 保留 token 驗證。
- 預估修復時間：0.5 天。

### 🔴-006 `DATA_SOURCE_MODE=real` 但外部 adapter 仍全部 mock，System 會誤判健康
- 模組：System / 外部整合
- 維度：環境變數、外部依賴、error state
- 現況：health 顯示 `DATA_SOURCE_MODE=real`、`DATABASE_PROFILE=neon`；integration-overview 顯示 `replit-data/ragic-auth/schedule/booking/storage` 全為 `mock` 且多數 `configured=true`，因為 mock 被視為 configured（`server/modules/system/routes.ts:603-616`）。
- 影響：IT 會以為整合健康，但實際仍沒有 Ragic、排班、booking、Replit data 真連線；這會拖垮「一眼端詳」的可信度。
- 建議：real mode 下 mock adapter 應標 `degraded/not_connected`，不可算 configured=true。
- 預估修復時間：0.5 天。

### 🔴-007 模組註冊 DB 與 manifest 規模不一致
- 模組：模組註冊系統
- 維度：modules 表、manifest、permissions、navigation
- 現況：manifest/registry 共 79 個 module；Neon `module_settings=20`、`module_role_permissions=0`、`module_facility_overrides=0`、`user_role_snapshots=0`、`sessions_index=0`。
- 影響：目前註冊真相主要仍在 code manifest，不在 DB；管理 UI 若要宣稱能治理模組開關/角色權限，資料未齊。
- 建議：決定「code manifest 為真」或「DB 為真」；若 DB 為上線治理面，需 seed/同步 79 modules + role permissions。
- 預估修復時間：1 天。

## 一般問題清單（⚠，建議修但不擋上線）
### ⚠-001 System detail routes 被 legacy redirect 收斂到 governance
- 模組：System governance
- 維度：路由與頁面一致性
- 現況：Browser 開 `/system/raw-inspector`、`/system/lifeguard-audit`、`/system/topology` 最終都在 `/system/governance`。`shared/navigation/workbench-routes.ts:78` 明確 redirect。
- 影響：若這些是刻意整併，OK；若 reviewer 預期每頁可直達，會判定頁面不存在。
- 建議：在 UI 與報告中標成「治理面 tabs」而不是獨立頁；或移除 redirect。
- 預估修復時間：0.5 天。

### ⚠-002 `system-lifeguard-audit` API 用 employee middleware 再手動判 system
- 模組：System / 救生稽核
- 維度：權限
- 現況：`/api/bff/system/lifeguard-audit` 使用 `deps.requireEmployee()`，再 `hasRole(req, "system")`；語意不一致。
- 影響：未來權限重構時容易誤放；System API 應由 system middleware 表達。
- 建議：改為 `requireSession + requireRole("system")`。
- 預估修復時間：0.5 小時。

### ⚠-003 員工失物招領與救生細節頁仍停在場館 gating 畫面
- 模組：失物招領、救生作業
- 維度：UI / UX
- 現況：Browser 開 `/employee/lost-and-found` 與多個 `/lifeguard/*` 作業頁時顯示「選擇今日場館」而不是直接進入內容；active facility 已透過 API 設定，但 gating 仍出現。
- 影響：使用者會以為模組沒打開；也可能是 route-level facility guard 與 session facility state 不同步。
- 建議：檢查 role/facility switch 後的前端 cache invalidation 與 guard 條件。
- 預估修復時間：0.5 ~ 1 天。

### ⚠-004 群組公告員工頁可進但 0 筆，且無明確來源狀態
- 模組：群組公告
- 維度：empty/error state
- 現況：Browser 開 `/employee/announcements` 顯示 0 則；DB `facility_announcement_groups=11` 但 `announcement_candidates=0`。
- 影響：員工無法知道是「真的沒有公告」還是「LINE / classifier 未接」。
- 建議：對公告來源提供 `ready/empty/not_connected/degraded` 區分。
- 預估修復時間：0.5 天。

### ⚠-005 Supervisor announcement-groups 仍露出 `LINE_BOT_ADMIN_TOKEN 未設定`
- 模組：公告群組綁定
- 維度：外部依賴、文案
- 現況：主管頁可見技術性 token 名稱；員工端已避免直接露出。
- 影響：主管可理解為設定問題，但仍偏工程語；若給非 IT 主管使用，會造成誤解。
- 建議：主管端改成「LINE 拉取權杖未設定」，細節放 System integration。
- 預估修復時間：0.5 小時。

### ⚠-006 prod / Replit log 未能完整檢查
- 模組：部署 / 運維
- 維度：prod log
- 現況：本機可查 `.tmp-codex` 與 Playwright console；沒有 Replit log connector 或 CLI session。未能「真的看 prod log」。
- 影響：Replit 首頁 timeout、BFF 慢查、Neon 連線池問題無法從本次報告定案。
- 建議：提供 Replit log access 或將 Replit logs 匯出到 repo/artifact 後重跑 audit。
- 預估修復時間：視 access 而定。

### ⚠-007 build bundle 偏大
- 模組：前端整體
- 維度：效能
- 現況：`npm run dry-run` build 警告 `assets/index-*.js` 約 1,938.73 kB，gzip 527.21 kB。
- 影響：Replit 首頁與角色切換可能載入久，尤其 supervisor/system 包含大量管理頁。
- 建議：route-level lazy import / manualChunks，把 system/admin-heavy pages 拆出去。
- 預估修復時間：1 ~ 2 天。

### ⚠-008 Browserslist / PostCSS warning
- 模組：build toolchain
- 維度：工程衛生
- 現況：Browserslist data 7 months old；PostCSS plugin 未傳 `from`。
- 影響：非立即阻擋，但會影響 CSS transform 信心。
- 建議：更新 browserslist DB，追 PostCSS plugin 來源。
- 預估修復時間：0.5 小時。

### ⚠-009 migrations 編號有兩個 `0007`
- 模組：DB migration
- 維度：schema 與 migrations 對照
- 現況：`0007_lifeguard_handover_extras.sql` 與 `0007_qna_supervisor_review.sql` 同號。
- 影響：人工排序可讀，但正式 migration journal/工具可能排序混淆。
- 建議：後續 migration 改成單調唯一序號，補 migration policy。
- 預估修復時間：0.5 小時。

### ⚠-010 `module_settings` 使用舊 module id 命名
- 模組：模組註冊系統
- 維度：manifest / DB 對照
- 現況：DB sample 有 `employee-announcements`、`employee-courts`、`supervisor-anomaly` 等 id；registry 使用 `announcements`、`courts`、`anomalies` 等 canonical id。
- 影響：DB 設定不一定能套回 registry；可能造成開關/排序不生效。
- 建議：做 id mapping migration 或重 seed canonical ids。
- 預估修復時間：0.5 ~ 1 天。

### ⚠-011 audit trail 有資料，但部分 registry 仍標 planned/partial
- 模組：Audit Trail
- 維度：audit trail
- 現況：Neon `audit_logs=12`；多個寫入點已呼叫 `recordAudit`，但 registry 仍標 `announcement-review`、`anomaly resolution`、`raw-inspector` 等 audit planned/partial。
- 影響：文件/manifest 與實作狀態不一致，reviewer 無法判定哪些已驗收。
- 建議：逐一用 DB row 驗證 11 個 Phase 0 寫入點，更新 registry 狀態。
- 預估修復時間：0.5 ~ 1 天。

### ⚠-012 `/api/watchdog/events` token gate OK，但 watchdog data 為 0
- 模組：System Watchdog
- 維度：外部依賴、資料流
- 現況：DB `watchdog_events=0`；System watchdog UI 可進但沒有真事件歷史。
- 影響：IT 視角無法證明監聽模組真的運作。
- 建議：用 internal token 寫入一筆測試事件，驗證 UI、DB、audit/retention。
- 預估修復時間：0.5 小時。

### ⚠-013 跨館測試只驗證 `xinbei_pool`
- 模組：跨館資料
- 維度：資料隔離
- 現況：DB 有 5 館；Browser smoke 主要以 `xinbei_pool` 跑。未完整逐一驗證三重、三民、松山、竹科資料隔離與共享公告 scope。
- 影響：跨館誤讀/漏讀風險仍在。
- 建議：補一個 role x facility x key modules smoke script。
- 預估修復時間：1 天。

### ⚠-014 PT scheduling / swimming class 邊界未定
- 模組：Scheduling
- 維度：外部系統一致性
- 現況：目前 CMS 中 schedule adapter 是 mock；PT scheduling 與 swimming class 是否納入本次上線未由 repo 證明。
- 影響：班表、課程、家教預告與人員資料可能分裂。
- 建議：上線前由 product owner 決定：本次只放預告，還是要納入正式資料源。
- 預估修復時間：決策 0.5 小時；整合另估。

## 模組逐項報告
### 首頁 dashboard
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `dashboard`、`employee-home`、`supervisor-dashboard`、`system-control-center` 皆在 registry。 |
| 路由與一致性 | ⚠ | `/EMPLOYEE` 初次停在場館選擇；若已選館仍被 guard 擋，需要確認 session/cache。 |
| UI / UX | ⚠ | 版型已可載入，但家教預告、weather、registration/checkins 等 planned surfaces 仍需標清楚。 |
| 資料流 | ⚠ | BFF fallback facility key 有 canonical mismatch。 |
| 權限 | ✅ | 需登入；角色切換 API 檢查 granted roles。 |
| Audit Trail | ⚠ | page view telemetry 有 `ui_events`，業務寫入需逐點驗。 |
| 外部依賴 | ⚠ | Replit/Ragic/Schedule adapter 仍 mock。 |
| 已知 bug / 待辦 | ⚠ | bundle 偏大，mock adapter 健康度誤導。 |

### 任務管理
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | registry 有 `tasks`，employee/supervisor/system 可見性存在。 |
| 路由與一致性 | 🔴 | `/employee/tasks` title 是錯誤交班標題。 |
| UI / UX | ⚠ | 頁可進、可顯示空狀態，但標題會誤導。 |
| 資料流 | ✅ | `/api/tasks` 有 BFF/legacy path，Browser 未見 500。 |
| 權限 | ⚠ | 員工/主管行為權限需補 lifecycle 寫入實測。 |
| Audit Trail | ✅ | `TASK_CREATED/UPDATED/STATUS_UPDATED` code path 存在。 |
| 外部依賴 | ✅ | 主要 DB。 |
| 已知 bug / 待辦 | 🔴 | 亂碼。 |

### 群組公告
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ⚠ | registry 有 `announcements`、`announcement-groups`、`announcement-review`；DB module_settings id 與 registry 不完全一致。 |
| 路由與一致性 | ⚠ | 員工 `/employee/announcements` 可進；主管 `/supervisor/announcements` 與 `/announcement-groups` 可進。 |
| UI / UX | ⚠ | 員工頁 0 筆但未清楚區分真空資料或外部未接。 |
| 資料流 | 🔴 | candidates/anomalies DB 0；候選審核仍 proxy LINE Bot。 |
| 權限 | ⚠ | admin routes 用 supervisor guard；候選 proxy routes仍需確認保護面。 |
| Audit Trail | ⚠ | announcement-groups CRUD 有 audit；candidate approve/reject audit 仍需驗證。 |
| 外部依賴 | 🔴 | `LINE_BOT_ADMIN_TOKEN` / LINE Bot webhook / replay 未證明。 |
| 已知 bug / 待辦 | 🔴 | classifier 真入口、source_message_ids、classifier_anomalies 未落資料。 |

### 櫃台交接
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `handover` 在 registry。 |
| 路由與一致性 | ✅ | `/employee/handover`、`/supervisor/handover` 可進。 |
| UI / UX | ✅ | empty state 有顯示。 |
| 資料流 | ⚠ | 需跨館寫入/回報 lifecycle 實測。 |
| 權限 | ✅ | employee report、supervisor manage 路徑有 guard。 |
| Audit Trail | ✅ | `HANDOVER_ENTRY_CREATED`、`OPERATIONAL_HANDOVER_*` code path 存在。 |
| 外部依賴 | ✅ | 主要 DB。 |
| 已知 bug / 待辦 | ⚠ | registry/DB module ids 需對齊。 |

### 活動檔期 / 課程快訊
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `activity-periods` / `campaigns-events` registered。 |
| 路由與一致性 | ✅ | `/employee/activity-periods` 可進並有資料。 |
| UI / UX | ✅ | 列表、filter、empty handling 基本可用。 |
| 資料流 | ⚠ | 與 registration/scheduling 邊界未定。 |
| 權限 | ⚠ | 員工可讀，主管建立/編輯 scope 需補走查。 |
| Audit Trail | ⚠ | 寫入 audit 需逐點驗 DB row。 |
| 外部依賴 | ⚠ | 若與課程報名系統整合，booking provider 仍 mock。 |
| 已知 bug / 待辦 | ⚠ | 課程報名頁目前是 not-connected surface。 |

### 常用文件
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `employee-resources` / documents route registered。 |
| 路由與一致性 | ✅ | `/employee/documents` 可進並顯示 5 筆。 |
| UI / UX | ✅ | filter/sort/empty state 存在。 |
| 資料流 | ⚠ | 受 fallback facility key 影響的資源 API 要再驗。 |
| 權限 | ⚠ | 員工 read、selected create、主管 manage 需 lifecycle 驗。 |
| Audit Trail | ✅ | `EMPLOYEE_RESOURCE_*` code path 存在。 |
| 外部依賴 | ⚠ | file upload/export object storage 仍偏 future/mock。 |
| 已知 bug / 待辦 | ⚠ | DB/module id 對齊。 |

### 員工教材
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `employee-training` registered。 |
| 路由與一致性 | ✅ | `/employee/training`、`/supervisor/training` 可進。 |
| UI / UX | ✅ | empty state 明確顯示尚未建立教材。 |
| 資料流 | ⚠ | Browser 顯示接 `employee_resources`，但測試資料 0。 |
| 權限 | ⚠ | supervisor 新增/employee read 需寫入實測。 |
| Audit Trail | ⚠ | resource audit 需對教材 category 驗 DB row。 |
| 外部依賴 | ✅ | 主要 DB。 |
| 已知 bug / 待辦 | ⚠ | 首批教材資料未 seed。 |

### 個人工作貼
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `personal-note` registered。 |
| 路由與一致性 | ✅ | `/employee/personal-note` 可進。 |
| UI / UX | ⚠ | 畫面顯示 0 則，但 console/API 有 403。 |
| 資料流 | 🔴 | 因 facility key mismatch 打 `xinbei-high-school` 被拒。 |
| 權限 | ⚠ | own note scope 未驗完。 |
| Audit Trail | ⚠ | resource create audit path 存在但此頁讀取失敗。 |
| 外部依賴 | ✅ | 主要 DB。 |
| 已知 bug / 待辦 | 🔴 | canonical facility key。 |

### 失物招領
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `lifeguard-lost-and-found` registered。 |
| 路由與一致性 | ⚠ | `/employee/lost-and-found`、`/lifeguard/lost-and-found` Browser 仍停在選場館 guard。 |
| UI / UX | ⚠ | 需要確認選場館後可否直接進入列表/表單。 |
| 資料流 | ⚠ | DB table 存在但本次未完成物件上傳/claim/dispose lifecycle。 |
| 權限 | ⚠ | employee/lifeguard/supervisor/system 權限區隔需補實測。 |
| Audit Trail | ✅ | `LIFEGUARD_LOST_ITEM_*` event types registered。 |
| 外部依賴 | ⚠ | object storage default mock。 |
| 已知 bug / 待辦 | ⚠ | facility guard / object storage。 |

### 場地預約
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | canonical `courts` 已在 registry/topology。 |
| 路由與一致性 | ✅ | `/employee/courts/xinbei`、`/supervisor/courts/xinbei` 可進。 |
| UI / UX | ✅ | 單日/週/月/搜尋/管理入口存在。 |
| 資料流 | ✅ | Neon `court_reservations=19`。 |
| 權限 | ⚠ | employee admin route 與 supervisor admin route 差異需補寫入測試。 |
| Audit Trail | ✅ | `COURTS_*` audit code path 存在。 |
| 外部依賴 | ⚠ | Google Calendar sync logs/errors table 有，但 sync 真入口未驗。 |
| 已知 bug / 待辦 | ⚠ | 跨館只抽查 xinbei。 |

### 相關問題詢問
| 維度 | 狀態 | 備註 |
|---|---|---|
| 模組註冊 | ✅ | `knowledge-base-qna` registered。 |
| 路由與一致性 | ✅ | `/employee/qna`、`/supervisor/qna-review` 可進。 |
| UI / UX | ⚠ | 員工頁顯示 0 筆，但 API 403。 |
| 資料流 | 🔴 | `facilityKey=xinbei-high-school` 被權限拒絕；Neon `knowledge_base_qna=10` 未顯示。 |
| 權限 | ⚠ | 審核 flow 需補 approve/reject DB audit 驗證。 |
| Audit Trail | ✅ | `KNOWLEDGE_QNA_*` code path 存在。 |
| 外部依賴 | ✅ | 主要 DB。 |
| 已知 bug / 待辦 | 🔴 | canonical facility key。 |

## 角色 × 模組可見性矩陣
| 模組 | EMPLOYEE | LIFEGUARD | SUPERVISOR | SYSTEM |
|---|---|---|---|---|
| 首頁 dashboard | ⚠ 可進；先顯示選館 guard | ⚠ 可進；先顯示選館 guard | ✅ 可進 | ✅ 可進 |
| 任務管理 | 🔴 可進但 title 亂碼 | ⚠ 共用模組 registered，未單頁實測 | ✅ 可進 | ⚠ registry 可觀察，非主要操作 |
| 群組公告 | ⚠ 可進但 0 筆 / 來源不明 | ⚠ registered，未單頁實測 | ⚠ 可進；candidate source 脫節 | ⚠ 可觀察但真入口未證明 |
| 櫃台交接 | ✅ 可進 | ⚠ registered，未單頁實測 | ✅ 可進 | ⚠ audit-only |
| 活動檔期 / 課程快訊 | ✅ 可進 | ⚠ registered，未單頁實測 | ⚠ homepage/registry 可見 | N/A |
| 常用文件 | ✅ 可進 | ⚠ registered，未單頁實測 | ⚠ manage via resources/training | N/A |
| 員工教材 | ✅ 可進但 0 筆 | ⚠ registered，未單頁實測 | ✅ 可進 | ⚠ registry 可見 |
| 個人工作貼 | 🔴 可進但 API 403 | ⚠ registered，未單頁實測 | N/A | N/A |
| 失物招領 | ⚠ 停在選館 guard | ⚠ 停在選館 guard | ⚠ overview 可見 | ⚠ audit route redirect 到 governance |
| 場地預約 | ✅ 可進 | N/A | ✅ 可進 | ⚠ registry/health only |
| 相關問題詢問 | 🔴 可進但 API 403 | ⚠ registered，未單頁實測 | ✅ 審核頁可進 | N/A |

## 外部依賴健康度
| 服務 | 狀態 | 備註 |
|---|---|---|
| Neon DB | ✅ | 可連線；58 張 public table；測試資料多數存在。 |
| Ragic auth | ⚠ | local health 顯示 adapter mode `mock`。mock 被算 configured，正式可信度不足。 |
| LINE Bot webhook / admin token | 🔴 | `LINE_BOT_ADMIN_TOKEN` 未證明；candidates/anomalies 0；候選列表 proxy 外部。 |
| Replit deployment / data BFF | ⚠ | local adapter mode `mock`；prod log 未能檢查。 |
| Smart Schedule / PT scheduling | ⚠ | schedule adapter `mock`；兩套 scheduling 邊界未定。 |
| Booking / swimming class | ⚠ | booking adapter `mock`；registration-courses 是 not-connected surface。 |
| Object storage | ⚠ | storage adapter `mock`；失物/照片正式儲存未驗。 |
| Redis/session index | ⚠ | redis mock / `sessions_index=0`。 |
| Watchdog | ⚠ | endpoint token gate 存在，但 DB `watchdog_events=0`。 |

## 已知技術債清單
- [ ] `client/src/modules/employee/tasks/page.tsx:231`：任務管理頁標題錯誤。
- [ ] `server/modules/bff/employee-home.ts:16`、`:78`：fallback facility key 是 `xinbei-high-school`，不在 canonical DB/session key 集合。
- [ ] `server/modules/system/routes.ts:583-621`、`:807-813`：system read endpoints 未全部要求 system session。
- [ ] `server/modules/telemetry/routes.ts:58-63`：system telemetry overview/module-events 未登入可讀。
- [ ] `server/modules/system/routes.ts:603-616`：mock adapter 被當 configured。
- [ ] `server/routes.ts:1039-1067`：announcement candidates 審核仍 proxy LINE Bot。
- [ ] `migrations/`：兩個 `0007_*` migration 檔。
- [ ] `module_settings`：DB 只有 20 筆，且 id 與 79-module registry 不完全一致。
- [ ] `module_role_permissions`、`module_facility_overrides`、`user_role_snapshots`、`sessions_index` 目前 0 筆。
- [ ] build warning：Browserslist data 過期。
- [ ] build warning：PostCSS plugin 未傳 `from`。
- [ ] build warning：main bundle 約 1.94MB。

## 推薦修復順序
1. [🔴-004] 先修 canonical facility key，讓員工首頁、個人工作貼、Q&A 不再 403。
2. [🔴-001] 修任務管理頁錯誤標題，並加入 encoding grep gate。
3. [🔴-005] 補 system BFF/telemetry read endpoints 權限。
4. [🔴-006] 修 System integration health：real mode 下 mock 不可顯示 healthy/configured。
5. [🔴-002] 驗證 LINE webhook / replay 真寫入 candidates、source_message_ids、classifier_anomalies。
6. [🔴-003] 決定 announcement candidates source of truth，收斂 proxy vs Neon DB。
7. [🔴-007] 補 module_settings / permissions seed 或明確宣告 code manifest 為真。
8. [⚠-001] 梳理 system governance detail route redirect 是否刻意整併。
9. [⚠-007] 拆 code-splitting，降低首頁 / supervisor / system 初載。
10. [⚠-013] 補 role x facility x module automated smoke。

## Appendix
### 檢查方法
- Repo gate：
  - `npm run check:modules`
  - `npm run check:workbench-governance`
  - `npm run check:announcement-classifier`
  - `npm run unit:modules`
  - `npm run dry-run`
- Browser：
  - 使用本機 `http://127.0.0.1:5000`
  - mock login `1111/1111`
  - 逐一切 `employee/lifeguard/supervisor/system` activeRole
  - 載入 42 個入口與主要模組頁，記錄 finalUrl、403/500、console error、亂碼與 not-connected copy。
- DB：
  - 用 Node `pg` 連 Neon，只查 schema/row count，不輸出 secret。
  - 檢查 table count、module_settings、module_role_permissions、announcement_candidates、classifier_anomalies、audit_logs、watchdog_events、ui_events。
- Static grep：
  - `rg "TODO|FIXME|XXX|LINE_BOT_ADMIN_TOKEN|source_message_ids|classifier_anomalies|xinbei-high-school"`
  - 比對 `shared/modules/registry.ts`、`shared/modules/descriptors.ts`、`shared/navigation/workbench-routes.ts`、`client/src/App.tsx`、`server/modules/*/routes.ts`。

### 未能檢查到的範圍
- Replit prod logs：本機沒有 Replit log connector / CLI access，本次只看 local server log 與 Browser console。
- 全量「每個模組 × 每個角色」點擊矩陣：本次 Browser 實測 42 個主要 role/module paths；未對 79 registry modules 全部逐頁操作。
- 寫入 lifecycle：本次只盤點，不新增/修改正式資料；因此 task create、handover report、Q&A approve、parking sign、lifeguard photo upload 等寫入只做 code/audit path 檢查。
- 跨館全量隔離：DB 確認 5 館存在，Browser 主要以 `xinbei_pool` 實測。
- PT scheduling / swimming class：repo 內 adapter 顯示 mock，外部系統部署狀態未能查。

### 給人類 reviewer 的提問
1. 群組公告 candidates 的正式 source of truth 要放 Neon，還是仍放 LINE Bot service？
2. `/system/raw-inspector`、`/system/topology`、`/system/lifeguard-audit` 被 redirect 到 `/system/governance` 是刻意整併成 tabs，還是要恢復獨立頁？
3. 家教預約 / registration-courses / checkins 在上線版是「預告可見」還是要從主工作台下架？
4. PT scheduling 與 swimming class 是否納入本次 CMS 上線？若不納入，首頁哪些區塊要標成預告？
5. `module_settings` 是否要成為正式治理資料源？如果是，是否同意重 seed 79 個 canonical module ids？
6. System health 對 mock adapter 的語意：是否同意 real mode 下全部 mock adapter 都算 degraded？
7. Replit prod log access 要用哪個方式提供，讓下一輪可以補上真 prod timeout / BFF latency 證據？
