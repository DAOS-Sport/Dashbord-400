# Replit 外接資料接線文件

日期：2026-04-24
適用專案：`400qian-duan-yi-biao-ban`

本文件給 Replit 端接線使用。原則是：前端不直連 Ragic、LINE Bot、Smart Schedule、Gmail 或資料庫；所有外部資料都要先進 Node BFF / Adapter，再輸出固定 DTO 給前端。

## 1. 接線模式

本地開發先用 mock：

```env
DATA_SOURCE_MODE=mock
DATABASE_PROFILE=mock
REPLIT_DATA_ADAPTER_MODE=mock
RAGIC_ADAPTER_MODE=mock
SCHEDULE_ADAPTER_MODE=mock
BOOKING_ADAPTER_MODE=mock
STORAGE_ADAPTER_MODE=mock
```

Replit 正式接線改為：

```env
NODE_ENV=production
PORT=5000

DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<Replit/Neon PostgreSQL connection string>

REPLIT_DATA_ADAPTER_MODE=real
RAGIC_ADAPTER_MODE=real
SCHEDULE_ADAPTER_MODE=real
BOOKING_ADAPTER_MODE=mock
STORAGE_ADAPTER_MODE=mock

LINE_BOT_BASE_URL=https://line-bot-assistant-ronchen2.replit.app
INTERNAL_API_TOKEN=<shared internal token for LINE Bot and Smart Schedule>
LINE_BOT_INTERNAL_TOKEN=<optional; defaults to INTERNAL_API_TOKEN when omitted>
SMART_SCHEDULE_BASE_URL=https://smart-schedule-manager.replit.app
SMART_SCHEDULE_API_TOKEN=<optional; defaults to INTERNAL_API_TOKEN when omitted>
EXTERNAL_API_TIMEOUT_MS=10000

RAGIC_API_KEY=<Ragic Basic Auth token, already base64 encoded>
RAGIC_HOST=ap7.ragic.com
RAGIC_ACCOUNT_PATH=xinsheng
RAGIC_EMPLOYEE_SHEET=/ragicforms4/13
RAGIC_FACILITY_SHEET=/ragicforms4/7

SESSION_COOKIE_NAME=workbench_sid
SESSION_TTL_SECONDS=28800
ALLOWED_ORIGINS=<Replit app URL>
```

若 Replit 另外提供獨立 projection service，才需要：

```env
REPLIT_DATA_BASE_URL=<projection service base URL>
REPLIT_DATA_API_TOKEN=<projection service token>
REPLIT_DATA_TIMEOUT_MS=8000
```

目前 `realReplitDataAdapter` 預設走 `LINE_BOT_BASE_URL` 的場館首頁 API，不強制使用 `REPLIT_DATA_BASE_URL`。

若上游有 server-to-server token，系統會自動同時帶：

```text
Authorization: Bearer <token>
X-Internal-Token: <token>
X-API-Key: <token>
```

LINE Bot Assistant 可使用 `LINE_BOT_INTERNAL_TOKEN`、既有 `REPLIT_DATA_API_TOKEN`，或共用 `INTERNAL_API_TOKEN`。
Smart Schedule Manager 可使用 `SMART_SCHEDULE_API_TOKEN`、`SMART_SCHEDULE_INTERNAL_TOKEN`，或共用 `INTERNAL_API_TOKEN`。

## 1.1 目前上游 API 狀態與修正方式

已確認可 server-to-server 直打：

```text
GET {LINE_BOT_BASE_URL}/api/announcement-dashboard/summary
GET {LINE_BOT_BASE_URL}/api/announcement-candidates
GET {LINE_BOT_BASE_URL}/api/announcement-reports/weekly
GET Ragic employee sheet with RAGIC_API_KEY
GET/POST Portal DB routes
```

新的 internal API 應優先使用：

```text
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{lineGroupId}/home
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{lineGroupId}/announcements
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{lineGroupId}/today-shift
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{lineGroupId}/handover
GET {SMART_SCHEDULE_BASE_URL}/api/internal/admin/overview
GET {SMART_SCHEDULE_BASE_URL}/api/internal/schedules/today?facilityKey=A
```

2026-04-24 實測：Smart Schedule internal API 已回 JSON；LINE Bot internal facility-home API 已回 JSON。若 LINE Bot `/home` 暫時回空公告，BFF 會忠實顯示該館目前無發布公告；若整個 internal source 非 JSON / 失敗，才會用公開 `announcement-candidates?groupId=...` 降級，只取該 LINE 群組的有效候選，並排除 `candidateType=ignore` / `status=vip_chat`。

本 repo 已完成兩層修正：

1. 若上游放行 token，本 repo adapter 會自動帶 token header 呼叫。
2. 若上游仍回 HTML / 401 / 403，本 repo 的 `/api/bff/employee/home` 會降級回傳可渲染 DTO：
   - 公告：優先 Portal system announcements，再用 public announcement candidates。
   - 交接：使用 Portal DB `handover_entries`。
   - 快速入口 / 文件：使用 Portal DB `quick_links`。
   - 班表：使用 Smart Schedule adapter，失敗時 section 標 `unavailable`，不讓前端白屏。

## 2. 前端固定入口

Replit 接線後不改前端程式碼，只驗證這些 route：

```text
/employee
/employee/tasks
/employee/announcements
/employee/handover
/employee/shift
/employee/more
/supervisor
/system
```

登入測試帳：

```text
帳號：1111
密碼：1111
```

mock auth 會預設 active role 為 `system`，但可切 `/EMPLOYEE`、`/SUPERVISOR`、`/SYSTEM`。

## 3. 後端 BFF 與資料來源對照

### 3.1 員工端首頁 / 任務 / 公告 / 班表

前端呼叫：

```http
GET /api/bff/employee/home
```

後端流程：

```text
client -> /api/bff/employee/home
       -> server/integrations/replit-data/*
       -> LINE Bot Assistant facility-home API
       -> EmployeeHomeDto
```

使用的外部來源：

```http
GET {LINE_BOT_BASE_URL}/api/facility-home/{lineGroupId}/home
GET {LINE_BOT_BASE_URL}/api/facility-home/{lineGroupId}/announcements
GET {LINE_BOT_BASE_URL}/api/facility-home/{lineGroupId}/today-shift
GET {LINE_BOT_BASE_URL}/api/facility-home/{lineGroupId}/handover
```

場館對照表在：

```text
shared/domain/facilities.ts
```

唯一允許寫死的是 LINE group id 對照，不要把其他外部資料寫死到前端。

### 3.2 員工交接

前端呼叫：

```http
GET /api/portal/handovers?facilityKey=xinbei_pool&limit=50
POST /api/portal/handovers
```

POST body：

```json
{
  "facilityKey": "xinbei_pool",
  "content": "晚班鑰匙放在抽屜第二層",
  "shiftLabel": "員工工作台"
}
```

注意：`authorEmployeeNumber`、`authorName` 不接受前端傳值，後端會用 cookie session 覆寫。

### 3.3 主管端

前端呼叫：

```http
GET /api/bff/supervisor/dashboard
GET /api/announcement-dashboard/summary
GET /api/announcement-candidates
GET /api/anomaly-reports
GET /api/admin/interview-users
```

外部來源：

```text
LINE Bot Assistant：公告候選池、公告摘要、場館公告
Smart Schedule Manager：排班總覽、面試授權
Portal DB：交接、quick-links、system announcements、events
```

### 3.4 系統端

前端呼叫：

```http
GET /api/bff/system/overview
GET /api/bff/system/integration-overview
GET /api/bff/system/ui-event-overview
```

外部來源健康檢查：

```text
LINE_BOT_BASE_URL
SMART_SCHEDULE_BASE_URL
RAGIC_API_KEY + Ragic endpoint
DATABASE_URL
```

Raw Inspector 只允許白名單 endpoint，不允許任意 URL：

```text
/api/bff/system/overview
/api/bff/system/integration-overview
/api/bff/supervisor/dashboard
/api/announcement-dashboard/summary
/api/admin/overview
```

## 4. Ragic 登入接線

Adapter：

```text
server/integrations/ragic/real-auth-adapter.ts
```

Ragic endpoint：

```http
GET https://ap7.ragic.com/xinsheng/ragicforms4/13?api&where=3000935,eq,{employeeNumber}
Authorization: Basic {RAGIC_API_KEY}
Accept: application/json
```

欄位：

```text
3000935 / 員工編號
3000933 / 姓名
3001424 / 手機
3000937 / 部門
3000939 / 職稱
3000945 / 在職狀態
```

手機比對規則：

```ts
String(phone || "").trim().replace(/[-\s()]/g, "")
```

職稱含以下任一關鍵字視為主管：

```text
主管 | 經理 | 組長 | 店長 | 館長 | 總監 | 協理 | 副理 | 副總
```

## 5. DB 接線

同步 schema：

```bash
npm run db:push
```

同步前建議：

```env
DATA_SOURCE_MODE=mock
DATABASE_PROFILE=mock
```

同步後切換：

```env
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<正式 PostgreSQL URL>
```

目前 Portal DB 會用到：

```text
handover_entries
quick_links
system_announcements
portal_events
notification_recipients
anomaly_reports
```

## 6. Replit 驗收 curl

登入：

```bash
curl -i -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"1111","password":"1111"}'
```

確認 session：

```bash
curl -b cookies.txt "$BASE/api/auth/me"
```

員工端 BFF：

```bash
curl "$BASE/api/bff/employee/home" | jq .
```

LINE Bot Assistant：

```bash
curl "$BASE/api/facility-home/C66a4b3bb3fbc3dcf52d42626ec512484/home" | jq .
curl "$BASE/api/facility-home/C66a4b3bb3fbc3dcf52d42626ec512484/today-shift" | jq .
```

Smart Schedule：

```bash
curl "$BASE/api/admin/overview" | jq .
curl "$BASE/api/admin/interview-users" | jq .
```

Portal DB：

```bash
curl "$BASE/api/portal/handovers?facilityKey=xinbei_pool" | jq .
curl "$BASE/api/portal/quick-links?facilityKey=xinbei_pool" | jq .
curl "$BASE/api/portal/system-announcements?facilityKey=xinbei_pool" | jq .
```

系統健康：

```bash
curl "$BASE/api/bff/system/overview" | jq .
curl "$BASE/api/bff/system/integration-overview" | jq .
```

## 7. 完成標準

- `/employee` 到 `/employee/more` 不需要改前端即可顯示正式資料。
- 外部 API 掛掉時，BFF 回 section status 或 503，不讓 React 白屏。
- DevTools localStorage 不含 session、role、facility 真相。
- 只有 `shared/domain/facilities.ts` 保留 LINE group id 常數。
- Ragic、LINE Bot、Smart Schedule、Portal DB 都只能由後端 adapter / proxy 呼叫。
- Replit 切 real mode 後，`npm run build` 必須通過。
