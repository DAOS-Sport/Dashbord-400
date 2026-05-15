# IT 端全角色監控與 Watchdog 詳細企畫書

版本：2026-05-11  
狀態：草案，待驗收後實作  
適用入口：`/system`

## 1. 目標

IT 端要成為整套駿斯 CMS 的「治理與監控中心」，不是另一個主管後台，也不是只顯示 debug JSON 的頁面。

本企畫書定義：

- 監控所有角色：員工、救生員、主管、系統。
- 監控所有模組：從 module registry、BFF、API、DB table、external integration、telemetry、audit 串起來。
- 加入 Watchdog：收集背景檢查、外部服務異常、前端錯誤、資料同步異常、部署健康狀態。
- 建立 IT 端可驗收的頁面與 API 規格。
- 建立「模組登記書」作為之後補功能、驗孤兒模組、驗孤兒路由的主檔。

## 2. 核心原則

- IT 端只做觀察、治理、診斷，不直接替代員工或主管的日常操作。
- 權限真相永遠來自 session：`activeRole`、`grantedRoles`、`activeFacility`、`grantedFacilities`、`permissionsSnapshot`。
- Module Registry 是模組真相，不在頁面元件裡額外硬寫一份模組清單。
- BFF 是 UI 的資料入口，前端不直接打 Ragic、LINE Bot、Smart Schedule、Object Storage。
- Watchdog 可以收事件，但不能繞過 auth、role、facility guard。
- 所有高風險觀察與設定查詢都要寫 audit。

## 3. 目前基準

目前 registry 檢查結果：

| 項目 | 數量 |
|---|---:|
| 總模組 | 74 |
| 已接線 implemented | 24 |
| 部分接線 partial | 37 |
| 預留 planned | 6 |
| legacy | 4 |
| external | 2 |
| deprecated | 1 |
| 已分組模組 | 74 |
| 未分組模組 | 0 |
| 可疑未綁 BFF 使用者模組 | 0 |

角色可見模組數：

| 角色 | 可見模組數 | 監控重點 |
|---|---:|---|
| Employee | 27 | activeFacility、首頁 BFF、公告、班表、場租、文件、便利貼 |
| Lifeguard | 27 | 六大救生作業、GPS/photo upload、救生日誌、救生 audit |
| Supervisor | 42 | 場館、停車場、櫃台日誌、水道租借、場地預約、公告群組、審核 |
| System | 51 | registry、function relations、topology、health、audit、watchdog、raw inspector |

## 4. IT 端資訊架構

建議 `/system` 下面固定為 8 個主要頁面。

| Route | 模組 | 用途 |
|---|---|---|
| `/system` | `system-dashboard` | 全站健康、角色摘要、今日風險、Watchdog 摘要 |
| `/system/function-relations` | `system-function-relations` | 母表/子表、BFF、API、模組關係總覽 |
| `/system/topology` | `system-topology` | 模組拓撲圖、外部整合節點、資料流 |
| `/system/health` | `system-health` | module health、route/BFF/API/DB/permission/telemetry 檢查 |
| `/system/alerts` | `system-observability` + `watchdog-events` | Watchdog、client errors、server events、外部異常 |
| `/system/integrations` | `integration-sync-jobs` | Ragic、LINE、Smart Schedule、Gmail、Object Storage 連線狀態 |
| `/system/audit` | `telemetry-audit` | audit_logs、ui_events、actor/role/facility 查詢 |
| `/system/raw-inspector` | `raw-inspector` | SYSTEM_ADMIN 限定，白名單 raw DTO/DB inspector |

## 5. 首頁設計：`/system`

System 首頁應該先回答 4 件事：

1. 今天系統能不能用。
2. 哪個角色或模組正在壞。
3. 哪些外部資料來源失聯。
4. 最近誰做了高風險操作。

### 5.1 首頁區塊

| 區塊 | 顯示內容 | 點擊去向 |
|---|---|---|
| 全域健康 KPI | ready / degraded / not_connected / error 模組數 | `/system/health` |
| 角色監控摘要 | employee/lifeguard/supervisor/system 各自 BFF 狀態 | `/system/health?role=...` |
| Watchdog 事件 | 最近 10 筆 critical/high 事件 | `/system/alerts` |
| 外部整合 | Ragic / LINE / Schedule / Gmail / Storage 狀態 | `/system/integrations` |
| Audit 熱點 | 最近高風險 action、失敗 action、raw inspector 查詢 | `/system/audit` |
| 模組登記狀態 | 74 模組分組、未分組、孤兒路由、孤兒 API | `/system/function-relations` |

### 5.2 KPI 定義

| KPI | 判定 |
|---|---|
| `readyModules` | production-ready 或 bff-wired 且 route/BFF/permission 正常 |
| `degradedModules` | BFF 可用但部分 integration/API/telemetry 失敗 |
| `notConnectedModules` | planned / ui-only / api-wired，或資料來源尚未接線 |
| `errorModules` | route/BFF/API 明確失敗 |
| `watchdogCritical24h` | 24 小時內 critical Watchdog event |
| `auditWrites24h` | 24 小時內寫入型 audit action |
| `externalDisconnected` | 外部整合 sourceStatus.connected=false |

## 6. 角色監控矩陣

### 6.1 Employee

監控目的：確認員工首頁與日常資料能依 activeFacility 正確載入。

| 類別 | 檢查 |
|---|---|
| Auth | 可登入、可切 role、可切 activeFacility |
| Home BFF | `/api/bff/employee/home` 是否回 stable homeCards |
| 場館 | `/api/auth/facility-candidates` 是否有 H05 名稱 |
| 公告 | LINE group / local announcement / system announcements 合併狀態 |
| 班表 | Smart Schedule read-only 是否可讀 |
| 場租 | `/employee/courts/:school` route 與 employee shell |
| 寫入 | handover、notes、resources、lost-and-found self report 是否寫 audit |

### 6.2 Lifeguard

監控目的：確認救生作業是否能安全落地，尤其 GPS/photo/audit。

| 類別 | 檢查 |
|---|---|
| Home | `/api/bff/lifeguard/home` 是否回六大作業摘要 |
| Photo Upload | `/api/bff/lifeguard/photo-upload` GPS 必填、storage fallback |
| Object Storage | photoKey/photoUrl 是否可用 |
| Geocoding | Nominatim failure 是否 degrade、不阻塞 |
| Records | `lifeguard_*` tables 是否有資料與 audit |
| Lane Issues | work-log category 或 lane issue table 是否一致 |
| Supervisor View | `/supervisor/lifeguard-overview` 能否看授權場館 |
| IT Audit | `/system/lifeguard-audit` 能否篩選模組/場館/日期 |

### 6.3 Supervisor

監控目的：確認營運管理入口完整，legacy route 不復活。

| 類別 | 檢查 |
|---|---|
| Dashboard | `/api/bff/supervisor/dashboard` summary 是否可用 |
| Facility Cards | CTA 是否進 `/supervisor/facilities/:facilityKey` |
| Parking | routes、tabs、CRUD、payment review、contract status |
| Counter Log | submissions/templates/tasks routes 與 supervisor shell |
| Lane Rentals | schedule grid、dialog、summary |
| Courts | supervisor/employee routes 分流與 audit |
| Announcement Groups | CRUD LINE group binding、test-fetch、audit |
| Legacy Redirect | `/admin/*`、裸 `/courts/*` 只 redirect，不渲染白色 legacy shell |

### 6.4 System

監控目的：IT 端可看見全系統，但不能把自己變成繞權限入口。

| 類別 | 檢查 |
|---|---|
| Module Registry | `/api/system/module-registry*` guard 與資料完整 |
| Function Relations | 母表子表、BFF、API、route、module group 完整 |
| Topology | module descriptor primary path 與 topology path 一致 |
| Health | routeOk / bffOk / permissionOk / telemetryOk |
| Audit | `/api/audit/logs` 可篩 actor/role/facility/action |
| Raw Inspector | 白名單 proxy、查詢寫 audit、拒絕也寫 audit |
| Watchdog | `/api/watchdog/events` ingestion + `/api/bff/system/watchdog-events` list |

## 7. Watchdog 設計

Watchdog 是系統背景監控與外部事件入口，分三種來源。

| 來源 | 說明 | 例子 |
|---|---|---|
| App Watchdog | CMS app 自己週期檢查 | BFF 失敗、DB table missing、module route missing |
| Integration Watchdog | 外部服務連線檢查 | Ragic timeout、LINE_BOT token missing、Schedule API failed |
| Client Watchdog | 前端上報 | client error、render crash、route load failed |

### 7.1 Watchdog Event Shape

```ts
interface WatchdogEventDto {
  id: string;
  severity: "info" | "warning" | "high" | "critical";
  source: "app" | "integration" | "client" | "manual";
  moduleId?: string;
  role?: "employee" | "lifeguard" | "supervisor" | "system";
  facilityKey?: string;
  title: string;
  message: string;
  routePath?: string;
  endpoint?: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
```

### 7.2 Watchdog Severity

| Severity | 條件 | UI |
|---|---|---|
| info | 正常事件、手動測試、恢復通知 | 灰/藍 |
| warning | 單一資料源 degraded，但頁面可用 | 黃 |
| high | 角色主流程失敗，例如 employee home BFF 失敗 | 橘 |
| critical | 登入、DB、核心 shell、system audit 無法使用 | 紅 |

### 7.3 Watchdog 檢查清單

| Check | 頻率 | 判定 |
|---|---:|---|
| Module registry consistency | build/dry-run + 手動 | no duplicate id、no orphan module |
| Workbench route presence | build/dry-run + 手動 | primary route exists in App runtime |
| Role BFF health | 1-5 分鐘 | employee/lifeguard/supervisor/system home endpoint 可回 |
| Ragic H05 | 5-15 分鐘 | 可回 facility candidates 或明確 unavailable |
| LINE Bot messages | 5-15 分鐘 | token 存在且 announcement group 可 test-fetch |
| Smart Schedule | 5-15 分鐘 | 今日班表可讀 |
| Object Storage | 15 分鐘 | 可產生 mock 或 real upload result |
| Audit writes | 15 分鐘 | 最近寫入型操作有 audit row |
| Client errors | 即時 | client error 數量異常升高 |

## 8. API 規格

### 8.1 已有或應保留

| Endpoint | 用途 |
|---|---|
| `GET /api/modules/health` | module descriptor health |
| `GET /api/system/module-registry` | registry raw view |
| `GET /api/system/module-registry/:id` | single module raw view |
| `GET /api/system/module-registry-role/:role` | role module list |
| `GET /api/audit/logs` | audit rows |
| `POST /api/bff/system/raw-inspector` | whitelist raw inspector |
| `POST /api/watchdog/events` | watchdog event ingestion |
| `GET /api/bff/system/watchdog-events` | watchdog event list |

### 8.2 建議新增

| Endpoint | 權限 | 回傳 |
|---|---|---|
| `GET /api/bff/system/role-monitoring` | system | 四角色 BFF/route/permission summary |
| `GET /api/bff/system/integration-overview` | system | 外部整合 sourceStatus |
| `GET /api/bff/system/deploy-readiness` | system | env/migration/smoke gates |
| `GET /api/bff/system/orphan-check` | system | orphan modules/routes/apis/tables |
| `POST /api/bff/system/watchdog/run-checks` | SYSTEM_ADMIN | 手動跑一次 safe checks |

## 9. 資料表與資料來源

| 資料 | 表 / 來源 | 目的 |
|---|---|---|
| Module Registry | `shared/modules/registry.ts` | 模組真相 |
| Descriptor | `shared/modules/descriptors.ts` | nav/card/permission/search/telemetry |
| Architecture Group | `shared/modules/architecture.ts` | 母系統分組 |
| Route Manifest | `shared/navigation/workbench-routes.ts` | primary route / legacy redirect |
| Audit | `audit_logs` | 誰做了什麼 |
| Watchdog | `watchdog_events` | 系統與外部事件 |
| Client Error | `client_errors` 或 telemetry source | 前端錯誤 |
| Integration Logs | `integration_error_logs`, `sync_job_runs` | 外部接線狀態 |
| BFF Projections | `employee_home_projection`, `supervisor_dashboard_projection`, `system_overview_projection` | 首頁投影 |

## 10. UI 規格

IT 端維持現有 workbench UI：

- 深藍 sidebar。
- 綠色 active。
- 淺灰背景。
- 白色 surface。
- 8px 內圓角。
- 高密度表格，不做行銷式 hero。
- 狀態顏色固定：ready 綠、degraded 黃、not_connected 灰、error 紅。

### 10.1 `/system/alerts`

頁面應包含：

- 上方 KPI：critical/high/warning/info。
- 左側 filter：severity、role、module、facility、source、date range。
- 主表格：時間、severity、module、role、facility、title、source、status。
- 右側 drawer：payload、endpoint、routePath、correlationId、相關 audit。

### 10.2 `/system/health`

頁面應包含：

- 模組狀態總覽。
- role tabs：all / employee / lifeguard / supervisor / system。
- 表格欄位：moduleId、status、routeOk、bffOk、permissionOk、telemetryOk、lastCheckedAt、issues。
- 一鍵複製問題報告。

### 10.3 `/system/function-relations`

頁面應包含：

- 母系統分組。
- 每個 module 的 route/API/table/integration/ownerRole。
- Module detail drawer。
- 母表子表關係圖。
- Orphan check section。

## 11. 驗收條件

第一階段完成後，至少要通過：

```bash
npm run type-check
npm run check:modules
npm run check:workbench-governance
npm run smoke:modules
npm run unit:modules
npm run dry-run
```

Browser smoke：

- `/system` 可看到全域健康與 Watchdog 摘要。
- `/system/health` 可列出 74 個模組健康狀態。
- `/system/function-relations` 顯示 8 個母系統，且 total=74、ungrouped=0。
- `/system/alerts` 可看到 watchdog events，空資料也有穩定 empty state。
- `/system/audit` 可看到 Watchdog/manual check 的 audit event。
- employee/supervisor 不能進 `/system/raw-inspector`。
- legacy `/admin/*` 不會渲染舊白色 shell。

## 12. 實作階段

### Phase 1：監控可視化

- `/system/health` 完整化。
- `/system/alerts` 接 watchdog events。
- `/system/function-relations` 補完整母表子表與 module detail drawer。
- `/system` 首頁加入 role monitoring summary。

### Phase 2：Watchdog 收斂

- 建立 role BFF watchdog check。
- 建立 integration watchdog check。
- 建立 module orphan watchdog check。
- 建立 client error aggregation。
- 所有 Watchdog 事件寫 `watchdog_events`。

### Phase 3：Deploy Readiness

- 新增 `/system/deploy-readiness` 或併入 `/system/health`。
- 檢查 env、migration、module registry、legacy redirect、DB table。
- 輸出 Replit acceptance checklist。

### Phase 4：治理操作

- SYSTEM_ADMIN 手動 run checks。
- SYSTEM_ADMIN 設定 threshold。
- 告警通知串 Email/LINE。
- 所有設定操作寫 audit。

## 13. 暫不做

- 不讓 IT 端直接修改 employee/supervisor/lifeguard 業務資料。
- 不做自動修復，只做偵測與提示。
- 不直接暴露 raw DB query。
- 不在前端放外部 service token。
- 不讓 Watchdog 事件變成業務資料真相。

## 14. 待你驗收的決策點

1. `/system/alerts` 是否正式作為 Watchdog 主入口。
2. `/system/health` 是否要同時包含 deploy readiness，或另開 `/system/deploy-readiness`。
3. Watchdog 寫入是否只允許 internal token，還是 session system 也能 POST。
4. critical/high 是否要第一版就寄 Email。
5. Module 登記書是否維持 Markdown 文件，還是下一輪直接做成 `/system/modules` UI。
