# DAOS 駿斯 — 系統 API 整合手冊（單檔版）

> 給外部開發 / 測試使用的 API 一覽。涵蓋：
> 1. **Ragic**（員工資料 + 登入認證來源）
> 2. **班表 400 小幫手 — LINE Bot Assistant**（公告候選池 + 場館首頁資料）
> 3. **班表 400 小幫手 — Smart Schedule Manager**（排班總覽 / 面試授權）
> 4. **本機 Portal Server**（駿斯儀表板自己的後端：交接、常用網址、系統公告、事件追蹤、登入）
>
> 嚴格規則：所有外部資料一律從 API 抓，**禁止 mock / 寫死**。唯一例外：LINE 群 ID（見下方對照表）。

---

## 0. 環境變數

| 變數 | 必填 | 預設 | 說明 |
| --- | --- | --- | --- |
| `RAGIC_API_KEY` | ✅ | — | Ragic Basic Auth token（注意：**已是 base64 編碼後的字串**，直接放在 `Authorization: Basic <RAGIC_API_KEY>` 不要再 base64） |
| `RAGIC_HOST` | ❌ | `ap7.ragic.com` | Ragic server host |
| `RAGIC_ACCOUNT_PATH` | ❌ | `xinsheng` | Ragic 帳號路徑 |
| `RAGIC_EMPLOYEE_SHEET` | ❌ | `/ragicforms4/13` | 員工表 sheet path |
| `GMAIL_USER` | ❌ | — | 寄信用 Gmail（異常通知） |
| `GMAIL_APP_PASSWORD` | ❌ | — | Gmail 應用程式密碼 |
| `DATABASE_URL` | ✅ | — | Postgres 連線字串（本機 Portal 用） |

---

## 1. Ragic（外部 SaaS）

### 1.1 員工資料表

- **Base URL**：`https://ap7.ragic.com/xinsheng/ragicforms4/13`
- **Auth**：`Authorization: Basic <RAGIC_API_KEY>`
- **Format**：`?api` query param 必加，回應為 JSON（key 是 row id）

#### 欄位 ID（FID）對照

| 用途 | FID（query 用） | Caption Key（response 用） |
| --- | --- | --- |
| 員工編號（主鍵） | `3000935` | `員工編號` |
| 姓名 | `3000933` | `姓名` |
| 手機（主表唯一手機欄位） | `3001424` | `手機` |
| 部門（回傳 `string[]`） | `3000937` | `部門` |
| 職稱 | `3000939` | `職稱` |
| 在職狀態 | `3000945` | `在職狀態` |

> ⚠️ 查詢用 numeric FID（例如 `where=3000935,eq,A001`），但解析回應時一律用 caption key（中文）。

#### 1.1.1 依員工編號查單筆

```bash
curl -X GET "https://ap7.ragic.com/xinsheng/ragicforms4/13?api&where=3000935,eq,A001" \
  -H "Authorization: Basic $RAGIC_API_KEY" \
  -H "Accept: application/json"
```

**Response（範例）**：
```json
{
  "1": {
    "員工編號": "A001",
    "姓名": "王小明",
    "手機": "0912345678",
    "部門": ["櫃台組"],
    "職稱": "館主管",
    "在職狀態": "在職"
  }
}
```

#### 1.1.2 主管判定規則（前端 / 本機 server 共用）

職稱含以下任一關鍵字即視為主管：
```
主管 | 經理 | 組長 | 店長 | 館長 | 總監 | 協理 | 副理 | 副總
```

#### 1.1.3 手機號碼正規化

登入比對前一律執行：
```ts
String(phone || "").trim().replace(/[-\s()]/g, "");
```

---

## 2. 班表 400 小幫手 — LINE Bot Assistant

- **Base URL**：`https://line-bot-assistant-ronchen2.replit.app`
- **Auth**：無（公開）
- **Timeout 建議**：10s
- **Content-Type**：`application/json`

### 2.1 公告候選池（Admin / 主管審核）

| Method | Path | 用途 | Query / Body |
| --- | --- | --- | --- |
| `GET` | `/api/announcement-dashboard/summary` | 公告摘要儀表板 | — |
| `GET` | `/api/announcement-candidates` | 候選列表 | `?page=1&pageSize=100&status=&candidateType=` 等 |
| `GET` | `/api/announcement-candidates/:id` | 候選詳情 | — |
| `POST` | `/api/announcement-candidates/:id/approve` | 核准 | `{ reviewedBy, comment? }` |
| `POST` | `/api/announcement-candidates/:id/reject` | 退回 | `{ reviewedBy, reason }` |
| `GET` | `/api/announcement-reports/weekly` | 週報 | — |

#### 候選資料形狀（精簡版）

```ts
type AnnouncementCandidate = {
  id: string;
  status: "pending" | "approved" | "rejected" | string;
  candidateType: string;          // 例如 schedule_change / closure / event
  title: string;
  summary: string;
  originalText: string;
  confidence: number;             // 0~1
  reasoningTags: string[];
  recommendedAction: string;
  recommendedReply: string;
  badExample?: string;
  appliesToRoles: string[];       // ["counter","coach"...] 或 ["all"]
  scopeType: "facility" | "global" | string;
  facilityName?: string;
  groupId?: string;               // LINE 群 ID（見下方對照表）
  displayName: string;            // 發布者
  userId: string;
  isFromSupervisor: boolean;
  startAt?: string;               // ISO
  endAt?: string;                 // ISO
  detectedAt: string;             // ISO
  sourceMessageId: string;
  extractedJson?: Record<string, unknown>;
};
```

### 2.2 場館首頁（員工值班入口）

> 所有 `:groupId` 必須是真實的 LINE 群組 ID（見 §5 對照表），不能用 `facilityKey`。

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/facility-home/:groupId/home` | 場館首頁聚合資料 |
| `GET` | `/api/facility-home/:groupId/announcements?page=&pageSize=` | 公告列表 |
| `GET` | `/api/facility-home/:groupId/announcements/:id` | 公告詳情 |
| `GET` | `/api/facility-home/:groupId/today-shift` | 今日班表 |
| `GET` | `/api/facility-home/:groupId/handover` | 上一班櫃台交接 |
| `POST` | `/api/facility-home/:groupId/announcements/:id/ack` | 員工回報已讀 |

#### Ack body

```json
{
  "employeeNumber": "A001",
  "employeeName": "王小明",
  "ackedAt": "2026-04-24T09:00:00Z"
}
```

#### curl 範例

```bash
GROUP_ID="C66a4b3bb3fbc3dcf52d42626ec512484"   # 新北高中
curl "https://line-bot-assistant-ronchen2.replit.app/api/facility-home/$GROUP_ID/home"
curl "https://line-bot-assistant-ronchen2.replit.app/api/facility-home/$GROUP_ID/today-shift"
```

---

## 3. 班表 400 小幫手 — Smart Schedule Manager

- **Base URL**：`https://smart-schedule-manager.replit.app`

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/overview` | 排班系統總覽 |
| `GET` | `/api/admin/interview-users` | 面試授權用戶 |

```bash
curl https://smart-schedule-manager.replit.app/api/admin/overview
```

---

## 4. 本機 Portal Server（駿斯儀表板自身）

- **Local Base**：`http://localhost:5000`（dev）／ Replit deployment URL（prod）
- 部分端點需要員工身份 header：

```
x-employee-number: A001
x-employee-name:   %E7%8E%8B%E5%B0%8F%E6%98%8E   ← URL-encoded
x-facility-key:    xinbei_pool
```

### 4.1 認證

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/auth/ragic-login` | 員工登入。**Body**：`{ employeeNumber, phone }`。後端會打 Ragic 驗證並比對手機。回傳 `{ employeeNumber, name, role, department, status, isSupervisor }` |
| `POST` | `/api/hr-audit` | （未啟用）回 503，等體育署 + Ragic 慎用名單接好 |

### 4.2 公告候選代理（轉打 §2.1）

`/api/announcement-dashboard/summary`、`/api/announcement-candidates`、`/api/announcement-candidates/:id`、`/api/announcement-candidates/:id/approve`、`/api/announcement-candidates/:id/reject`、`/api/announcement-reports/weekly`

外加：
- `GET /api/announcement-candidates/export/all` — 自動分頁抓全部公告候選並寫出 `/exports/announcement-candidates-export.json`
- `GET /exports/:filename` — 下載匯出檔

### 4.3 場館首頁代理（轉打 §2.2）

`/api/facility-home/:groupId/home|announcements|announcements/:id|today-shift|handover|announcements/:id/ack`

### 4.4 排班管理代理（轉打 §3）

`/api/admin/overview`、`/api/admin/interview-users`

### 4.5 Portal — 櫃台交接（DB：`handover_entries`）

| Method | Path | 權限 |
| --- | --- | --- |
| `GET` | `/api/portal/handovers?facilityKey=&limit=50` | 公開 |
| `POST` | `/api/portal/handovers` | 員工（作者強制以 caller 為準） |
| `DELETE` | `/api/portal/handovers/:id` | 作者本人 or 主管 |

POST body（僅 `facilityKey`、`content`、`shiftLabel?` 等業務欄位；`authorEmployeeNumber` / `authorName` 由 server 強制覆寫，body 給的會被忽略）。

### 4.6 Portal — 常用網址 / 系統公告（主管維護）

| Method | Path | 權限 |
| --- | --- | --- |
| `GET` | `/api/portal/quick-links?facilityKey=&includeInactive=true` | 公開 |
| `POST/PATCH/DELETE` | `/api/portal/quick-links[/:id]` | 主管 |
| `GET` | `/api/portal/system-announcements?facilityKey=&includeInactive=true` | 公開 |
| `POST/PATCH/DELETE` | `/api/portal/system-announcements[/:id]` | 主管 |

### 4.7 Portal — 事件追蹤 / 分析

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/portal/events` | 記錄一筆事件（自動從 header 解出 employee / facility）。Body：`{ eventType, target, targetLabel?, metadata? }`。回 204 |
| `GET` | `/api/portal/analytics?sinceDays=30&facilityKey=` | 統計 |

### 4.8 異常通報

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/anomaly-report` | multipart：欄位 `context`（必填）+ 任意附件 |
| `GET` | `/api/anomaly-reports` | 列表 |
| `GET` | `/api/anomaly-reports/:id` | 詳情 |
| `PATCH` | `/api/anomaly-reports/:id/resolution` | `{ resolution: "pending"\|"resolved" }` |
| `PATCH` | `/api/anomaly-reports/batch/resolution` | `{ ids: number[], resolution }` |
| `DELETE` | `/api/anomaly-reports/:id` | — |

### 4.9 通知收件人 + 測試信

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/api/notification-recipients` | 列表 |
| `POST/PATCH/DELETE` | `/api/notification-recipients[/:id]` | `{ email }`（簡單 email 驗證） |
| `POST` | `/api/test-email` | 寄一封給所有收件人或 `GMAIL_USER` |

---

## 5. 場館 ↔ LINE 群組 ID 對照表（**唯一允許寫死的常數**）

| facilityKey | 場館全名 | 短名 | 區域 | LINE Group ID |
| --- | --- | --- | --- | --- |
| `xinbei_pool` | 新北高中游泳池&運動中心 | 新北 | 新北 | `C66a4b3bb3fbc3dcf52d42626ec512484` |
| `salu_counter` | 駿斯-三蘆區櫃台 | 三蘆 | 三蘆區 | `Cc2100498c7c5627c1e86e93f7c4eb817` |
| `songshan_pool` | 松山國小室內溫水游泳池 | 松山 | 三蘆區 | `C9b3c5dfe2e005adafd2ed914714a1930` |
| `sanmin_pool` | 三民高中游泳池 | 三民 | 三蘆區 | `C2dc6991e51074dd47d5d275d568318f7` |

> 三蘆區帳號（指 `salu_counter` / `songshan_pool` / `sanmin_pool`）：在 Portal 內可切換場館，新北為跨區，受權限限制。

---

## 6. 共用回應 / 錯誤格式

### 成功
```json
{ "items": [...] }            // 列表
{ "success": true, ... }       // 操作類
{ ...資源本體 }                 // 單一資源
```

### 失敗
```json
{ "message": "中文錯誤訊息", "errors"?: { "fieldErrors": {...} } }
```

| HTTP | 意義 |
| --- | --- |
| 400 | 參數錯誤 / Zod 驗證失敗（看 `errors`） |
| 401 | 未登入（缺 `x-employee-number` 或 Ragic 查無此人） |
| 403 | 權限不足（`需主管權限` / `員工已離職`） |
| 404 | 資源不存在 |
| 502 | 上游 API 連線失敗（Ragic / LINE-Bot / Smart-Schedule） |
| 503 | 服務未設定（例：未設 `RAGIC_API_KEY`） |

---

## 7. TypeScript 通用 fetch helper（複製即用）

```ts
const BASE = "http://localhost:5000"; // 或部署 URL

type EmployeeHeaders = {
  employeeNumber?: string;
  employeeName?: string;
  facilityKey?: string;
};

export async function api<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
  emp?: EmployeeHeaders,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers || {}),
  };
  if (init.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (emp?.employeeNumber) headers["x-employee-number"] = emp.employeeNumber;
  if (emp?.employeeName) headers["x-employee-name"] = encodeURIComponent(emp.employeeName);
  if (emp?.facilityKey) headers["x-facility-key"] = emp.facilityKey;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { status: res.status, data });
  return data as T;
}

// 範例：登入
const me = await api<{ employeeNumber: string; name: string; isSupervisor: boolean }>(
  "/api/auth/ragic-login",
  { method: "POST", body: JSON.stringify({ employeeNumber: "A001", phone: "0912345678" }) },
);

// 範例：拿場館首頁
const GROUP_ID = "C66a4b3bb3fbc3dcf52d42626ec512484";
const home = await api(`/api/facility-home/${GROUP_ID}/home`);

// 範例：建立交接（需員工身份）
await api("/api/portal/handovers", {
  method: "POST",
  body: JSON.stringify({ facilityKey: "xinbei_pool", content: "晚班鑰匙在抽屜第二格", shiftLabel: "晚班" }),
}, { employeeNumber: me.employeeNumber, employeeName: me.name, facilityKey: "xinbei_pool" });
```

---

## 8. 快速冒煙測試清單

```bash
# 1. Ragic 直連（要先 export RAGIC_API_KEY=xxx）
curl -s "https://ap7.ragic.com/xinsheng/ragicforms4/13?api&where=3000935,eq,A001" \
  -H "Authorization: Basic $RAGIC_API_KEY" | jq .

# 2. LINE Bot Assistant
curl -s https://line-bot-assistant-ronchen2.replit.app/api/announcement-dashboard/summary | jq .
curl -s https://line-bot-assistant-ronchen2.replit.app/api/facility-home/C66a4b3bb3fbc3dcf52d42626ec512484/home | jq .

# 3. Smart Schedule Manager
curl -s https://smart-schedule-manager.replit.app/api/admin/overview | jq .

# 4. 本機 Portal
curl -s http://localhost:5000/api/portal/handovers?facilityKey=xinbei_pool | jq .
curl -s -X POST http://localhost:5000/api/auth/ragic-login \
  -H "Content-Type: application/json" \
  -d '{"employeeNumber":"A001","phone":"0912345678"}' | jq .
```

---

_最後更新：2026-04-24_
