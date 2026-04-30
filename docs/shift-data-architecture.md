# 班表資料架構書 · Shift Data Architecture

> 最後更新：2026-04-30 · 場館：新北高中游泳池&運動中心 (`xinbei_pool`)

---

## 一、需求核心

| 需求 | 對應欄位 |
|---|---|
| **誰當班（名稱）** | `employeeName` |
| **目前是否在班** | `status = "active"` |
| **班次時段** | `startsAt` / `endsAt` / `period` |
| **在哪個場地** | `venueName` |

---

## 二、資料流水線

```
SmartSchedule (外部)
  └─ GET /api/internal/export/snapshot?from=&to=&facilityKey=
       ↓ raw JSON: { schedules: [...], shifts: [...], employees: [...], venues: [...] }

real-adapter.ts · mapExportSchedule()
  └─ ScheduleShift[]          ← 已過濾休假/取消，已對齊 facilityKey

BFF employee-home.ts
  └─ ShiftSummary[]           ← 計算 status (active/upcoming/finished)

Frontend ShiftSummary[]
  └─ 顯示當班人員列表
```

---

## 三、各層欄位定義

### 3-1 上游原始欄位（SmartSchedule export row）

每筆 `schedule` 物件包含巢狀子物件：

```jsonc
{
  "rawId": "shift_1508",         // 排班系統流水號
  "sourceRowId": "...",

  "shift": {
    "startAt": "2026-04-30T16:00:00+08:00",
    "endAt":   "2026-04-30T22:30:00+08:00",
    "period":  "late",           // early / mid / late / custom
    "label":   "晚班"
  },
  "employee": {
    "employeeNumber": "0901377",
    "name": "吳偉德"
  },
  "venue": {
    "key": "xinbei_pool",
    "name": "新北高中館",
    "shortName": "新北高中館",
    "aliases": ["新北高中游泳池"]
  },
  "assignment": {
    "status": "scheduled",       // scheduled / changed / completed
    "kind":   "regular"          // regular / overtime / substitute
  },
  "raw": {
    "role": "救生員"             // 休假/取消/請假 → 過濾排除
  }
}
```

### 3-2 介面卡輸出（`ScheduleShift`）

`server/integrations/schedule/adapter.ts`

| 欄位 | 型別 | 來源 | 說明 |
|---|---|---|---|
| `id` | `string` | `rawId / sourceRowId` | 唯一識別 |
| `rawId` | `string?` | `row.rawId` | 原始 ID |
| `facilityKey` | `string` | 查詢參數 | 場館 key |
| `employeeNumber` | `string?` | `employee.employeeNumber` | 員工編號 |
| `employeeName` | `string?` | `employee.name` | **員工姓名** ✅ |
| `venueName` | `string?` | `venue.name` | 場地名稱 |
| `startsAt` | `string` | `shift.startAt` | ISO 8601 |
| `endsAt` | `string` | `shift.endAt` | ISO 8601 |
| `period` | `"early"/"mid"/"late"/"custom"` | `shift.period` | 早/中/晚班 |
| `kind` | `string?` | `assignment.kind` | regular/substitute |
| `assignmentStatus` | `string?` | `assignment.status` | scheduled/completed |
| `label` | `string` | 拼接：姓名 / 場地 / 班別 | 顯示用 |
| `timeRange` | `string?` | `startsAt - endsAt` | 顯示用時段 |

### 3-3 BFF 輸出（`ShiftSummary`）

`shared/domain/workbench.ts`

| 欄位 | 型別 | 計算方式 |
|---|---|---|
| `id` | `string` | 同 ScheduleShift.id |
| `employeeName` | `string?` | 直接傳遞 ✅ |
| `venueName` | `string?` | 直接傳遞 |
| `startsAt` | `string?` | ISO 8601（前端顯示用） |
| `endsAt` | `string?` | ISO 8601（前端顯示用） |
| `status` | `"active"/"upcoming"/"finished"` | **now ∈ [startsAt, endsAt] → active** |
| `label` | `string` | 同 ScheduleShift.label |
| `timeRange` | `string` | 格式化後 |
| `kind` | `string?` | regular/substitute |

---

## 四、`status` 計算規則

```
now < startsAt          → "upcoming"  （未到班）
startsAt ≤ now < endsAt → "active"   （當班中）✅
now ≥ endsAt            → "finished"  （已下班）
```

---

## 五、1~2 天真實資料快照

> 日期：2026-04-30，場館：新北高中游泳池&運動中心

### 今日班表（共 8 筆）

| 姓名 | 班次 | 開始 | 結束 | 狀態 | 場地 |
|---|---|---|---|---|---|
| 李昱霖 | regular | 00:00 | 00:00 | **active** | 新北高中館 |
| 蔡霆諺 | regular | 05:30 | 08:00 | finished | 新北高中館 |
| 吳偉德 | regular | 05:30 | 14:30 | finished | 新北高中館 |
| 陳正鴻 | regular | 05:30 | 16:00 | finished | 新北高中館 |
| 賴姿伶 | regular | 05:30 | 14:30 | finished | 新北高中館 |
| 陳均維 | regular | 08:00 | 17:00 | **active** | 新北高中館 |
| 楊淯晴 | regular | 16:00 | 22:30 | **active** | 新北高中館 |
| 翁丞妤 | regular | 16:00 | 22:30 | **active** | 新北高中館 |

**當班中（active）：4 人** ｜ 已下班：4 人

---

## 六、班表頁面最小需求欄位

> 若只顯示「誰當班 + 名稱 + 時段」，需要以下 5 個欄位：

```ts
interface MinimalShiftCard {
  id: string;           // 去重 key
  employeeName: string; // 姓名 ✅
  status: "active" | "upcoming" | "finished"; // 當班狀態 ✅
  startsAt: string;     // 開始時間
  endsAt: string;       // 結束時間
  // ── 加分欄位 ──
  venueName?: string;   // 場地（多場地管理時重要）
  period?: string;      // 早/中/晚班分組用
  employeeNumber?: string; // 未來連結員工檔案
}
```

---

## 七、取得 1~2 天資料的查詢方式

### 透過 BFF（推薦）

```
GET /api/bff/employee/home
→ .shifts.data[]   （只回今天班表）
```

### 透過 Adapter 直接查 Range（跨天需求）

```ts
await scheduleAdapter.listRangeShifts({
  facilityKey: "xinbei_pool",
  from: "2026-04-30",   // 今天
  to:   "2026-05-01",   // 明天
})
// → ScheduleShift[]，依 startsAt 排序後分組顯示
```

### 若要開放 BFF 跨天查詢，建議新增端點：

```
GET /api/bff/employee/shift-board?from=2026-04-30&to=2026-05-01
→ ShiftBoardDto（已有型別定義，見 shared/domain/workbench.ts:130）
```

> `ShiftBoardDto` 已定義 `facility`、`date`、`now`、`shifts[]` 含 `people[]`，適合直接作為班表頁 API 合約。

---

## 八、缺口與建議

| 項目 | 現況 | 建議 |
|---|---|---|
| 跨天查詢 | BFF 只回今天 | 補 `/shift-board` 端點 |
| `period` 分組 | Adapter 有，BFF ShiftSummary 缺 | 加入 ShiftSummary |
| `employeeNumber` | Adapter 有，BFF 未傳 | 加入 ShiftSummary，連員工檔案用 |
| 班表更新推播 | 無 | 可考慮 SSE 或定時輪詢 30s |
| 跨場館顯示 | supervisor 端有 byFacility | 員工端只顯示所屬場館 |
