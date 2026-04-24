# Replit API 架構書

日期：2026-04-24
適用專案：`400qian-duan-yi-biao-ban`

## 1. 核心原則

- 前端只呼叫本專案 BFF，不直接打 Ragic、LINE Bot、Smart Schedule。
- BFF 依登入 session 的 `activeFacility` 決定資料範圍。
- Ragic 的 `部門` 欄位是館別授權來源；LINE group id 只做外部公告資料定位。
- 本平台自己的交班/交接、入口連結、Widget 記錄與稽核資料都存 Portal DB，不寫回外部 SaaS。
- 外部 API 若回 HTML / 401 / 403，BFF 必須回可渲染 JSON section，不讓 dashboard 白屏。

## 2. Replit Secrets / Config

```env
NODE_ENV=production
PORT=5000

DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<Neon Postgres URL>

REPLIT_DATA_ADAPTER_MODE=real
RAGIC_ADAPTER_MODE=real
SCHEDULE_ADAPTER_MODE=real
BOOKING_ADAPTER_MODE=mock
STORAGE_ADAPTER_MODE=mock

INTERNAL_API_TOKEN=<LINE Bot 與班表系統共用 token>
LINE_BOT_BASE_URL=https://line-bot-assistant-ronchen2.replit.app
SMART_SCHEDULE_BASE_URL=https://smart-schedule-manager.replit.app
EXTERNAL_API_TIMEOUT_MS=10000

RAGIC_API_KEY=<Ragic Basic Auth token>
RAGIC_HOST=ap7.ragic.com
RAGIC_ACCOUNT_PATH=xinsheng
RAGIC_EMPLOYEE_SHEET=/ragicforms4/13

SESSION_COOKIE_NAME=workbench_sid
SESSION_TTL_SECONDS=28800
```

`INTERNAL_API_TOKEN` 會自動作為 `LINE_BOT_INTERNAL_TOKEN` 與 `SMART_SCHEDULE_API_TOKEN` 的 fallback。呼叫上游時 BFF 會同時帶：

```http
Authorization: Bearer <token>
X-Internal-Token: <token>
X-API-Key: <token>
```

## 3. 館別授權

Ragic 員工表 `部門` 回傳陣列，例如 `["新北高中", "三民高中"]`。後端映射在 `shared/domain/facilities.ts`。

| Ragic 部門別名 | 本系統 facilityKey | LINE group id |
| --- | --- | --- |
| 新北高中 | `xinbei_pool` | `C66a4b3bb3fbc3dcf52d42626ec512484` |
| 三重商工 / 三蘆 | `salu_counter` | `Cc2100498c7c5627c1e86e93f7c4eb817` |
| 松山國小 | `songshan_pool` | `C9b3c5dfe2e005adafd2ed914714a1930` |
| 三民高中 | `sanmin_pool` | `C2dc6991e51074dd47d5d275d568318f7` |

非主管登入後只會取得 Ragic 部門對應的 `grantedFacilities`。主管 / system 帳號保留全館切換。

## 4. 上游 Internal API

### LINE Bot Assistant

```http
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{groupId}/home
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{groupId}/announcements
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{groupId}/announcements/{id}
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{groupId}/today-shift
GET {LINE_BOT_BASE_URL}/api/internal/facility-home/{groupId}/handover
```

BFF 期待 `/home` 回：

```json
{
  "facilityName": "新北高中游泳池&運動中心",
  "facilityShortName": "新北高中",
  "groupId": "C66a4b3bb3fbc3dcf52d42626ec512484",
  "mustRead": [],
  "announcements": [],
  "campaigns": [],
  "handover": [],
  "todayShift": [],
  "generatedAt": "2026-04-24T10:00:00.000Z"
}
```

公告必須包含 `groupId` 或 `facilityLineGroupId`。BFF 會再次檢查群組，避免跨館公告進 dashboard。

### Smart Schedule Manager

```http
GET {SMART_SCHEDULE_BASE_URL}/api/internal/admin/overview
GET {SMART_SCHEDULE_BASE_URL}/api/internal/schedules/today?facilityKey=A
```

`today` 回傳的 `shifts[]` 需含 `employee` 與 `venue`。BFF 會用 `venue.name` 比對目前館別，只顯示該館班表。

## 5. 本平台 Portal API

### 5.1 交班 / 交接主資料

主管建立交班，員工端依館別與班別顯示、回報：

```http
GET    /api/portal/operational-handovers?facilityKey=xinbei_pool&limit=100
POST   /api/portal/operational-handovers
PATCH  /api/portal/operational-handovers/{id}
PATCH  /api/portal/operational-handovers/{id}/report
DELETE /api/portal/operational-handovers/{id}
```

建立 body：

```json
{
  "facilityKey": "xinbei_pool",
  "title": "更衣室施工提醒",
  "content": "今日晚班交接時確認施工圍籬與告示是否完成。",
  "priority": "normal",
  "targetDate": "2026-04-24",
  "targetShiftLabel": "晚班",
  "visibleFrom": "2026-04-24T08:00:00+08:00",
  "dueAt": "2026-04-24T22:00:00+08:00",
  "linkedActionType": "clock",
  "linkedActionUrl": "https://example.com"
}
```

員工回報 body：

```json
{
  "status": "reported",
  "reportNote": "已確認，告示貼在櫃台與入口。"
}
```

狀態值：

`pending | claimed | in_progress | reported | done | cancelled`

### 5.2 快速入口

```http
GET /api/portal/quick-links?facilityKey=xinbei_pool
```

目前前端保留「點名 / 打卡」與「報名 / 課程」入口；設備回報與會款管理先不進員工端主要入口。

## 6. BFF 對前端 API

前端固定呼叫：

```http
GET /api/bff/employee/home
```

可選：

```http
GET /api/bff/employee/home?facilityKey=xinbei_pool
```

若有登入 session，指定 `facilityKey` 必須存在於 `grantedFacilities`，否則回 403。

前端收到的固定 DTO：

```json
{
  "facility": { "key": "xinbei_pool", "name": "新北高中游泳池&運動中心" },
  "announcements": { "status": "ok", "data": [{ "title": "公告", "deadlineLabel": "2026/04/30", "content": "內容" }] },
  "shifts": { "status": "ok", "data": [{ "employeeName": "王小明", "venueName": "新北高中", "timeRange": "08:00 - 16:00" }] },
  "handover": { "status": "ok", "data": [{ "title": "交班", "targetDate": "2026-04-24", "targetShiftLabel": "晚班" }] },
  "tasks": { "status": "ok", "data": [] },
  "shortcuts": { "status": "ok", "data": [] },
  "campaigns": { "status": "ok", "data": [] },
  "documents": { "status": "ok", "data": [] }
}
```

`status` 可能是 `ok | degraded | unavailable`。前端只能依 section status 顯示狀態，不自行呼叫外部來源。

`tasks` 欄位目前作為舊前端相容的「交班待處理摘要」，正式主資料仍是 `/api/portal/operational-handovers`。

主管端固定呼叫：

```http
GET /api/bff/supervisor/dashboard
```

其中：

- `staffing.activeEmployees`：Ragic 現職人員。
- `staffing.currentOnDuty`：Smart Schedule 當前當班人員。
- `staffing.nextOnDuty`：Smart Schedule 下一班人員。
- `incompleteTasks`：交班/交接未完成摘要。
- `handoverOverview`：交班/交接開啟與完成數。

系統端固定呼叫：

```http
GET /api/bff/system/overview
GET /api/bff/system/integration-overview
GET /api/bff/system/ui-event-overview
```

## 7. 降級規則

如果 LINE Bot internal `/home` 回 HTML 或非 JSON：

1. BFF 改用 `GET /api/announcement-candidates?groupId={lineGroupId}`。
2. 只保留 `candidateType !== "ignore"`、`status !== "vip_chat"`、`confidence >= 0.7` 的候選。
3. Smart Schedule 仍從 internal schedule API 補今日班表。
4. 回傳 `announcements.status="degraded"`，但畫面照常渲染。

## 8. Smoke Test

```bash
BASE=https://<400qian-duan-yi-biao-ban-replit-url>

curl -s "$BASE/api/auth/me"
curl -s "$BASE/api/bff/employee/home" | jq '.facility,.announcements.status,.shifts.status'
curl -s "$BASE/api/bff/supervisor/dashboard" | jq '.staffing.data.active,.staffing.data.onShift'
curl -s "$BASE/api/admin/overview" | jq .
curl -s "$BASE/api/portal/handovers?facilityKey=xinbei_pool" | jq .
curl -s "$BASE/api/portal/operational-handovers?facilityKey=xinbei_pool" | jq .
```

上游直打測試：

```bash
curl -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  "$SMART_SCHEDULE_BASE_URL/api/internal/admin/overview" | jq .

curl -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  "$SMART_SCHEDULE_BASE_URL/api/internal/schedules/today?facilityKey=A" | jq .

curl -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  "$LINE_BOT_BASE_URL/api/internal/facility-home/C66a4b3bb3fbc3dcf52d42626ec512484/home" | jq .
```

2026-04-24 本機實測：Smart Schedule internal API 200 JSON；LINE Bot internal facility-home API 200 JSON。新北高中 `/home` 目前公告與交接為空陣列，BFF 會保留空公告狀態，並用 Smart Schedule internal API 補強今日班表。
