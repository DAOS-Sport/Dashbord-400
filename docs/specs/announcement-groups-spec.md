# 群組重要公告 — 多場館 LINE 群組綁定 規格書

> **目標**：把 `/employee` 首頁的「群組重要公告」卡片，從目前 hard-coded stub 改為「依當前 active facility 拉對應 LINE 群組真實訊息」。
> **新增能力**：主管端可 CRUD 「facility ↔ LINE groupId」綁定關係。
> **適用實作者**：Codex（branch `codex/module-entry-parking-registry-20260508` 或新 branch）。
> **作者**：Replit Agent / 2026-05-08
> **狀態**：待實作

---

## 1. 範圍與不在範圍

### In scope
- 1 張新表：`facility_announcement_groups`
- 後端模組：`server/modules/announcement-groups/{client,storage,routes}.ts`
- BFF 改寫：`server/modules/bff/employee-home.ts` 的 `announcements` section
- 主管端 CRUD 頁：`/admin/announcement-groups`
- Sidebar 入口（主管端「設定」分組）
- e2e 測試

### Out of scope（後續再做，不要這次塞進來）
- @All 自動偵測機制
- 已讀/未讀（`isAcknowledged`）
- 公告分類、優先度排序演算法
- 推播給 LINE bot 反向通知
- 圖片/影片/sticker 訊息渲染（這次只處理 `type=text`）

---

## 2. 環境前置

### 必要 env / secret
| Key | 來源 | 用途 |
|---|---|---|
| `LINE_BOT_BASE_URL` | 已存在 (`server/shared/config/env.ts:35`) | upstream base，預設 `https://line-bot-assistant-ronchen2.replit.app` |
| `LINE_BOT_ADMIN_TOKEN` | **新增（已加入 Replit Secrets）** | 上游 `/api/admin/messages` 的 Bearer token |

env loader 加一行：
```ts
// server/shared/config/env.ts
lineBotAdminToken: read("LINE_BOT_ADMIN_TOKEN") || null,
```
若 `null`，整個模組以「降級模式」運作（公告卡顯示 `unavailable`，admin 頁顯示警告 banner，CRUD 仍可用以便預先設定）。

---

## 3. 資料層

### 3.1 新表 schema (寫進 `shared/schema.ts`)

```ts
export const facilityAnnouncementGroups = pgTable("facility_announcement_groups", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),         // 對應 shared/domain/facilities.ts
  lineGroupId: text("line_group_id").notNull(),        // LINE C 開頭 group ID
  label: text("label").notNull(),                      // 顯示用名稱，例：「新北重要公告」
  isActive: boolean("is_active").default(true).notNull(),
  lookbackHours: integer("lookback_hours").default(24).notNull(), // 拉幾小時內訊息
  notes: text("notes"),                                // 主管備註，可空
  createdBy: text("created_by"),                       // 建立者 userId
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqFacilityGroup: uniqueIndex("uniq_facility_group").on(t.facilityKey, t.lineGroupId),
  byFacility: index("idx_announcement_groups_facility").on(t.facilityKey),
}));

export const insertFacilityAnnouncementGroupSchema = createInsertSchema(facilityAnnouncementGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFacilityAnnouncementGroup = z.infer<typeof insertFacilityAnnouncementGroupSchema>;
export type FacilityAnnouncementGroup = typeof facilityAnnouncementGroups.$inferSelect;
```

**驗證規則**（額外 zod refine）：
- `facilityKey` 必須在 `shared/domain/facilities.ts` 的 facility list 內
- `lineGroupId` regex `^C[0-9a-f]{32}$`（32 hex chars after `C`）
- `lookbackHours` 範圍 1–168（1 小時到 7 天）
- `label` 1–60 字元

### 3.2 Migration
```bash
npm run db:push --force
```
不需手寫 migration SQL（drizzle-kit 自動處理）。

### 3.3 IStorage 擴充 (`server/storage.ts`)
```ts
listAnnouncementGroups(filters?: { facilityKey?: string; isActive?: boolean }): Promise<FacilityAnnouncementGroup[]>;
getAnnouncementGroupById(id: number): Promise<FacilityAnnouncementGroup | undefined>;
createAnnouncementGroup(input: InsertFacilityAnnouncementGroup): Promise<FacilityAnnouncementGroup>;
updateAnnouncementGroup(id: number, patch: Partial<InsertFacilityAnnouncementGroup>): Promise<FacilityAnnouncementGroup>;
deleteAnnouncementGroup(id: number): Promise<void>;  // 軟刪除：實作為 isActive=false，PATCH 路由可重新啟用
```

> **注意**：刪除為**硬刪除**（DELETE row），停用走 `update isActive=false`。原因：使用者通常會誤建錯 groupId，硬刪比較直觀。

---

## 4. 後端模組

### 4.1 檔案結構
```
server/modules/announcement-groups/
  ├── client.ts           # upstream LINE bot client + cache
  ├── storage.ts          # 把上面 IStorage 方法的實作集中在此（DrizzleStorage 真的方法寫在 server/storage.ts）
  ├── transforms.ts       # LINE message → AnnouncementSummary mapper
  └── routes.ts           # express router
```

### 4.2 `client.ts` — upstream client

```ts
// server/modules/announcement-groups/client.ts
import { env } from "@/server/shared/config/env";

export interface LineMessageDto {
  id: string;
  messageId: string;
  timestamp: string;       // ISO
  sourceType: "user" | "group" | "room";
  groupId: string | null;
  roomId: string | null;
  userId: string;
  displayName: string;
  type: "text" | "image" | "video" | "sticker" | "file" | "audio" | "location";
  text: string | null;
  createdAt: string;
}

export interface LineMessagesResponse {
  messages: LineMessageDto[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  nextSince: string | null;
  count: number;
}

interface CacheEntry {
  fetchedAt: number;
  data: LineMessagesResponse;
}

const CACHE_TTL_MS = 30_000;  // 30 秒
const cache = new Map<string, CacheEntry>();

export async function fetchLineMessages(params: {
  groupId: string;
  hours?: number;
  type?: "text";
  limit?: number;
}): Promise<LineMessagesResponse> {
  if (!env.lineBotAdminToken) {
    throw new Error("LINE_BOT_ADMIN_TOKEN not configured");
  }

  const url = new URL("/api/admin/messages", env.lineBotBaseUrl);
  url.searchParams.set("groupId", params.groupId);
  url.searchParams.set("type", params.type ?? "text");
  url.searchParams.set("sourceType", "group");
  url.searchParams.set("limit", String(params.limit ?? 30));
  if (params.hours) {
    const start = new Date(Date.now() - params.hours * 3_600_000).toISOString();
    url.searchParams.set("start", start);
  }

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.lineBotAdminToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`upstream ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as LineMessagesResponse;
  cache.set(cacheKey, { fetchedAt: Date.now(), data });
  return data;
}

export function clearLineMessagesCache() {
  cache.clear();
}
```

**重點**：
- 30 秒 in-memory cache（單 instance OK）
- 10 秒 timeout
- token 永不出現在錯誤訊息中（只回 status code）
- `clearLineMessagesCache()` 給 admin「測試拉訊息」按鈕用，繞過 cache

### 4.3 `transforms.ts` — message → AnnouncementSummary

```ts
// shared/domain/workbench.ts AnnouncementSummary 既有 shape:
// { id, title, body?, priority?, publishedAt, ... }

import type { LineMessageDto } from "./client";
import type { AnnouncementSummary } from "@shared/domain/workbench";

export function lineMessageToAnnouncement(
  msg: LineMessageDto,
  groupLabel: string,
): AnnouncementSummary {
  const text = msg.text ?? "";
  const firstLine = text.split("\n")[0]?.slice(0, 60) || "(無內容)";
  const isImportant = /@all/i.test(text) || /【重要】|【公告】|‼️|❗/.test(text);

  return {
    id: msg.id,
    title: firstLine,
    body: text,
    priority: isImportant ? "required" : "optional",
    publishedAt: msg.timestamp,
    publisher: msg.displayName,
    sourceLabel: groupLabel,
    isAcknowledged: false,  // 暫不實作
    sourceType: "line-group",
    sourceRefId: msg.groupId,
  };
}
```

> 若 `AnnouncementSummary` 沒有 `sourceLabel`/`sourceType`/`sourceRefId` 欄位，請在 `shared/domain/workbench.ts` 補上 optional 欄位（**不影響現有資料**）。

### 4.4 `routes.ts` — Express router

掛在 `server/routes.ts`，路徑 `/api`：

```ts
// 公開給員工讀（拉自己場館的公告）
GET  /api/integrations/announcement-groups/messages
  Query: facilityKey (string, required) | hours (1..168, default 24) | limit (default 30)
  Auth: requireEmployee
  Response: {
    facility: { key, name },
    groups: Array<{ id, label, lineGroupId }>,
    announcements: AnnouncementSummary[],   // 已 transform，按 publishedAt DESC
    fetchedAt: ISO,
    sourceStatus: { connected: boolean, errorMessage: string|null }
  }
  行為：
    1. 從 storage 拉該 facility 的所有 isActive=true 綁定
    2. 並行 fetchLineMessages(每個 groupId)
    3. 全部 flatMap、去重（by msg.id）、依 timestamp DESC、取前 limit 筆
    4. 任何 group 失敗不阻斷其他 group，但 errorMessage 要回

// 主管 CRUD
GET    /api/admin/announcement-groups                   requireSupervisor
POST   /api/admin/announcement-groups                   requireSupervisor
       Body: insertFacilityAnnouncementGroupSchema
PATCH  /api/admin/announcement-groups/:id               requireSupervisor
       Body: insertFacilityAnnouncementGroupSchema.partial()
DELETE /api/admin/announcement-groups/:id               requireSupervisor

// admin 「測試拉訊息」按鈕用，繞 cache 直打 upstream
POST   /api/admin/announcement-groups/:id/test-fetch    requireSupervisor
       Response: {
         ok: boolean,
         sampleCount: number,
         latestMessage: { displayName, text, timestamp } | null,
         errorMessage: string | null
       }
```

**Auth middleware**：複用既有 `requireEmployee()` / `requireSupervisor()`（在 `server/shared/auth/middleware.ts`）。

**錯誤處理**：所有 route 用既有 `asyncHandler` wrapper；upstream 錯誤統一回 502 + `{ error, code: "UPSTREAM_ERROR" }`。

### 4.5 在 `server/routes.ts` 註冊
```ts
import { registerAnnouncementGroupRoutes } from "./modules/announcement-groups/routes";
// ...
registerAnnouncementGroupRoutes(app);
```
位置：放在 `registerObjectStorageRoutes(app)` 之後。

### 4.6 BFF 改寫 `server/modules/bff/employee-home.ts`

把目前 `announcements:` 的 stub array 換掉：

```ts
// 偽碼
const groups = await storage.listAnnouncementGroups({ facilityKey: dto.facility.key, isActive: true });
let announcements: AnnouncementSummary[] = [];
let sourceStatus = { connected: true, lastSyncedAt: now, errorMessage: null };

if (groups.length === 0) {
  sourceStatus = { connected: false, lastSyncedAt: now, errorMessage: "尚未綁定 LINE 公告群組，請主管至 /admin/announcement-groups 設定" };
} else if (!env.lineBotAdminToken) {
  sourceStatus = { connected: false, lastSyncedAt: now, errorMessage: "LINE_BOT_ADMIN_TOKEN 未設定" };
} else {
  const results = await Promise.allSettled(groups.map(g =>
    fetchLineMessages({ groupId: g.lineGroupId, hours: g.lookbackHours, type: "text", limit: 30 })
      .then(r => r.messages.map(m => lineMessageToAnnouncement(m, g.label)))
  ));
  announcements = results
    .flatMap(r => r.status === "fulfilled" ? r.value : [])
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 20);
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length > 0 && announcements.length === 0) {
    sourceStatus = { connected: false, lastSyncedAt: now, errorMessage: `所有群組拉取失敗 (${failed.length})` };
  }
}

dto.announcements = { data: announcements, sourceStatus };
```

---

## 5. 前端

### 5.1 新增主管 CRUD 頁

**檔案**：`client/src/pages/admin/announcement-groups.tsx`

**佈局**：
```
┌─────────────────────────────────────────────────────────────┐
│ 群組重要公告 — 場館綁定                                      │
│                                          [新增綁定 +]        │
├─────────────────────────────────────────────────────────────┤
│ ⚠ LINE_BOT_ADMIN_TOKEN 未設定（若沒設）                      │
├─────────────────────────────────────────────────────────────┤
│ 場館        │ 群組ID(縮)  │ 標籤        │ 回溯  │ 狀態 │ 動作│
│─────────────┼──────────────┼─────────────┼───────┼──────┼─────│
│ 新北高中泳池 │ Cd383…7839 │ 新北重要公告 │ 24h  │ 啟用 │ 編輯 測試 刪除 │
│ 三民國中泳池 │ Ce37d…36b5 │ 三民值班通知 │ 12h  │ 啟用 │ 編輯 測試 刪除 │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

**新增/編輯 modal**（使用 shadcn `Dialog` + `useForm`）：
- 場館（Select：列出所有 facility）
- LINE Group ID（input，regex 驗證 `^C[0-9a-f]{32}$`）
- 標籤（input，1–60 字元）
- 回溯小時數（input number 1–168，預設 24）
- 備註（textarea，optional）
- 啟用狀態（switch）

**測試按鈕行為**：
1. 點擊 → POST `/api/admin/announcement-groups/:id/test-fetch`
2. 顯示 toast：
   - 成功：「✓ 拉到 X 筆訊息，最新一則：${latestMessage.text.slice(0,40)}...」
   - 失敗：「✗ ${errorMessage}」

**data fetching**：`useQuery({ queryKey: ['/api/admin/announcement-groups'] })`
**mutations**：用 `apiRequest` (POST/PATCH/DELETE)，成功後 `queryClient.invalidateQueries({ queryKey: ['/api/admin/announcement-groups'] })` + invalidate `/api/bff/employee/home`

**data-testid**：所有按鈕、輸入欄、列必須加：
- `button-add-announcement-group`
- `input-line-group-id`
- `select-facility`
- `row-announcement-group-${id}`
- `button-edit-${id}` / `button-test-${id}` / `button-delete-${id}`

### 5.2 註冊路由

**`client/src/App.tsx`**（`WorkbenchRouter` 內，catch-all 之前）：
```tsx
<Route path="/admin/announcement-groups" component={AdminAnnouncementGroupsPage} />
```

### 5.3 Sidebar 入口

**`client/src/components/app-sidebar.tsx`**：在「設定」分組下新增：
```tsx
{ label: "公告群組綁定", href: "/admin/announcement-groups", icon: MessageSquareWarning }
```
僅 supervisor role 可見。

### 5.4 公告卡 UI

**完全不動** — `AnnouncementCard` 既有 props 是 `AnnouncementSummary[]`，BFF 改完後自動吃到真資料。

---

## 6. 拓撲圖更新

**`client/src/config/topology-config.ts`** 新增：
```ts
{ id: "line-bot-messages-api", label: "LINE Bot Messages API", group: "external" },
{ id: "announcement-groups", label: "公告群組綁定 (DB)", group: "data" },
// edges
{ from: "employee-home-bff", to: "announcement-groups" },
{ from: "employee-home-bff", to: "line-bot-messages-api" },
{ from: "admin-announcement-groups", to: "announcement-groups" },
```

---

## 7. 文件更新

**`replit.md`** 新增章節：
```markdown
## 群組重要公告綁定 (announcement-groups)
- 主管端：`/admin/announcement-groups` (CRUD facility ↔ LINE groupId)
- 員工端：`/employee` 公告卡自動依 active facility 拉對應 LINE 群組訊息
- 後端模組：`server/modules/announcement-groups/`
- Upstream：`https://line-bot-assistant-ronchen2.replit.app/api/admin/messages`
- Auth：Bearer token 從 `LINE_BOT_ADMIN_TOKEN` env 讀取
- Cache：30s in-memory（per groupId+hours+limit）
- Schema：`facility_announcement_groups` 表
```

---

## 8. 驗收條件

實作者完成後必須通過以下測試（用 testing skill 跑 `runTest`）：

### Test 1: Schema migration
- [ ] `npm run db:push --force` 無錯誤
- [ ] `\d facility_announcement_groups` 顯示 9 個 column

### Test 2: Empty state
- [ ] 員工登入 (1111/0000) → `/employee` → 公告卡顯示 「尚未綁定 LINE 公告群組...」訊息（非 stub data）

### Test 3: Admin CRUD
- [ ] 切到 supervisor (主管登入) → 點 sidebar「公告群組綁定」
- [ ] 看到空表格 + 「新增綁定」按鈕
- [ ] 新增：facility=`xinbei_pool`, groupId=`C66a4b3bb3fbXXXXXXXXXXXXXXXXXXXX`（給一個合法格式的測試 ID）, label=「測試公告」
- [ ] 表格立即出現新列
- [ ] 點「測試」按鈕 → toast 顯示拉到的訊息數
- [ ] 點「編輯」改 label → 表格更新
- [ ] 點「刪除」→ 確認 dialog → 列消失

### Test 4: 真實連線
- [ ] 用真實 groupId（從 `/api/admin/messages` 探到的）建一個綁定
- [ ] 切回員工首頁 → 公告卡顯示真實 LINE 訊息（最新在前）
- [ ] 不同 facility 切換時公告卡內容會跟著換

### Test 5: 降級
- [ ] 暫時 unset `LINE_BOT_ADMIN_TOKEN` → 重啟 → 公告卡顯示「LINE_BOT_ADMIN_TOKEN 未設定」、admin 頁顯示警告 banner、CRUD 仍可用

### Test 6: Code review
- [ ] 跑 `architect()` 在 `server/modules/announcement-groups/` 整個 slice + `client/src/pages/admin/announcement-groups.tsx`
- [ ] 修掉所有 critical/high finding

---

## 9. 工時與依賴

| 階段 | 估時 | 依賴 |
|---|---|---|
| Schema + IStorage | 30 分 | — |
| Backend module + routes | 60 分 | Schema |
| BFF wire | 30 分 | Backend |
| Admin UI | 90 分 | Backend |
| Sidebar + topology + docs | 20 分 | Admin UI |
| e2e + code review | 60 分 | All |
| **合計** | **~4.5 小時** | |

---

## 10. 給 Codex 的額外提醒

1. **不要動 `shared/schema.ts` 的既有 table** — 只新增 `facilityAnnouncementGroups` 和對應 schema/types。
2. **不要在前端寫死 token** — 一律走 BFF 中轉。
3. **不要在 log 印 token** — `console.log(env.lineBotAdminToken)` 絕對禁止。
4. **不要在 error response 把 upstream 原始 body 完整回給客戶端** — 可能含 LINE userId/messageId 等敏感資訊。
5. **`@shared/...` 路徑** 用 alias，不要相對 import。
6. **commit message 規範**：`feat(announcement-groups): ...` / `fix(announcement-groups): ...`
7. **branch 建議**：`codex/announcement-groups-{date}`
8. **完成後**：開 PR 標題 `feat: 群組重要公告 多場館綁定 (announcement-groups module)`，body 貼這份 spec 連結 + 截圖 + 驗收 checklist。

---

## 11. 開放問題（實作可自行判斷）

1. 同一 group 在多個 facility 下都綁定時，員工切 facility 時公告會重複出現嗎？→ **會，但可接受**。如要去重再做 v2。
2. 公告卡要不要加「來源群組」標籤？→ **建議加**（用 `sourceLabel` 欄），UI 顯示 small badge。
3. 是否需要 audit log（誰改了綁定）？→ **這次不做**，未來統一接 audit module。

---

**END OF SPEC**
