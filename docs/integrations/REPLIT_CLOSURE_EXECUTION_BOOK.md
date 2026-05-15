# Replit 收尾執行書

版本：2026-04-30

## 1. 收尾目標

讓 Replit 部署環境能完成端到端驗收：

1. 員工端核心模組可用。
2. 主管端營運總覽、場館詳細、任務、公告、櫃台交接、教材、異常、報表可用。
3. 公告從主管端建立後，員工端公告 / 首頁能讀到同一筆資料。
4. audit_logs / ui_events / client_errors 真實落 DB。
5. 未接線來源顯示 `not_connected`，不塞假資料。

## 2. Replit 環境變數

部署前確認：

```txt
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<Replit / Neon Postgres URL>
RAGIC_ADAPTER_MODE=real
RAGIC_API_KEY=<secret>
RAGIC_FACILITY_SHEET=/ragicforms4/7
SESSION_COOKIE_NAME=workbench_sid
```

選配：

```txt
SMART_SCHEDULE_BASE_URL=<schedule service>
SMART_SCHEDULE_API_TOKEN=<secret>
LINE_BOT_BASE_URL=<line bot service>
LINE_BOT_INTERNAL_TOKEN=<secret>
GMAIL_SMTP_*=<smtp secrets>
```

不要把 secret 寫進 repo。

## 3. Migration / DB 檢查

部署前在 Replit DB 確認 migrations 已套用：

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'system_announcements'
ORDER BY ordinal_position;
```

必須包含：

```txt
id
title
content
announcement_type
severity
is_pinned
facility_key
facility_keys
published_at
published_by
expires_at
is_active
created_by
created_by_role
updated_by
updated_at
source
created_at
```

也要確認：

```sql
SELECT to_regclass('public.audit_logs');
SELECT to_regclass('public.ui_events');
SELECT to_regclass('public.client_errors');
SELECT to_regclass('public.announcement_acknowledgements');
SELECT to_regclass('public.knowledge_base_qna');
```

## 4. 指令驗收

在 Replit shell 依序跑：

```bash
npm run type-check
npm run check
npm run smoke:modules
npm run check:modules
npm run build
```

目前 smoke 應檢查到：

- `/api/bff/employee/home` 必須 require session。
- supervisor dashboard 不可讓 employee / anonymous 進入。
- employee BFF enrich 路徑必須合併 `system_announcements`。
- 主管場館卡片可進 `/supervisor/facilities/:facilityKey`。
- domain writes 必須寫 audit。

## 5. Email 式端到端查驗：主管公告 -> 員工顯示

像查 Email 一樣驗證「發出、收件、已讀」。

### 5.1 發出

1. 登入 `1111 / 1111`。
2. 切到主管端 `/supervisor/announcements`。
3. 新增公告：
   - 類型：通知或必讀。
   - 場館：新北高中游泳池或目前 active facility。
   - 置頂：開。
   - 啟用：開。
   - 發布時間：現在或過去。
   - 下架時間：空白或未來。
4. 儲存後頁面應立即在主管公告列表看到該筆。

DB 檢查：

```sql
SELECT id, title, announcement_type, is_pinned, facility_key, is_active, published_at, expires_at
FROM system_announcements
ORDER BY id DESC
LIMIT 5;
```

### 5.2 收件

1. 用同一帳號或員工帳號切到 `/employee`。
2. 確認首頁「群組重要公告」顯示剛才公告。
3. 進 `/employee/announcements`。
4. 搜尋公告標題。
5. 應能看到該公告，且置頂 / 類型顯示正確。

BFF 檢查：

```bash
curl -b cookie.txt http://localhost:5000/api/bff/employee/home
```

回傳 `announcements.data` 應包含：

```json
{
  "id": "portal-ann-<id>",
  "title": "<剛新增的公告>",
  "isPinned": true
}
```

### 5.3 已讀 / 確認

1. 在員工公告頁點確認或已讀。
2. 重整頁面。
3. 該公告的確認狀態仍存在。

DB 檢查：

```sql
SELECT announcement_id, facility_key, user_id, acknowledged_at
FROM announcement_acknowledgements
ORDER BY acknowledged_at DESC
LIMIT 10;
```

## 6. 本輪本機查驗結果

已確認：

- `/api/auth/login` 可用，`1111 / 1111` 回傳 supervisor/system 權限與 `xinbei_pool` 等場館。
- `/api/portal/system-announcements` create route 存在且有 supervisor guard。
- `system_announcements` create / update 已寫 `recordAudit`。
- 員工 BFF fallback 與 enrich 路徑現在都會讀正式 `system_announcements`。

本機未通過：

- POST `/api/portal/system-announcements` 回 `500 {"message":"建立失敗"}`。
- 本機 shell 顯示 `DATABASE_PROFILE=mock`、`DATA_SOURCE_MODE=mock`、`DATABASE_URL` 不存在，無法從 shell 直接查目前 localhost dev server 的 DB columns。

Replit 判讀：

- 若 Replit 也出現 500，優先查 DB schema 是否缺 `0006` 或 `0003` 的欄位。
- 若 DB 欄位完整，再看 server log 的 `[system-announcements:create_failed]` 或 Drizzle insert error。

## 7. 主管端功能驗收清單

| 頁面 | 驗收 |
|---|---|
| `/supervisor` | KPI、橫向場館卡、快速操作、近期活動；場館卡「進入」連到 detail |
| `/supervisor/facilities` | 可看各場館詳細資訊、授權場館篩選、當班/交辦/任務 |
| `/supervisor/facilities/:facilityKey` | 直接進指定場館 detail，不顯示未授權館 |
| `/supervisor/tasks` | 新增任務右側 drawer、列表、狀態更新、audit |
| `/supervisor/announcements` | 手動發布、類型、置頂、啟用、發布/下架時間 |
| `/supervisor/handover` | 三欄看板，不要求班別 |
| `/supervisor/training` | 教材新增與查閱，employee_resources category=training |
| `/supervisor/anomalies` | 處理/重開異常，寫 resolved metadata 與 audit |
| `/supervisor/reports` | supervisor BFF / portal analytics，不呼叫 system overview |

## 8. 員工端功能驗收清單

| 模組 | 驗收 |
|---|---|
| 首頁 | homeCards 穩定，空狀態不破版 |
| 交辦事項 | 新增 drawer、列表、完成 |
| 活動檔期 / 課程快訊 | 圖卡、網址圖片、分類 |
| 常用文件 | 連結可直接開，分類可自訂，排序可切換 |
| 個人工作記事 | 快速便利貼，日期時間選填 |
| 員工教材 | 可看影片 / 圖片 / 文件 |
| 相關問題詢問 | Q&A 可新增、搜尋、首頁模糊搜尋可查 |
| 群組公告 | 可讀、可搜尋、可確認 |

## 9. 極端情況驗收

| 情境 | 預期 |
|---|---|
| 公告發布時間在未來 | 員工端不顯示 |
| 公告下架時間已過 | 員工端不顯示 |
| 公告未啟用 | 員工端不顯示 |
| 公告指定 A 場館 | B 場館員工看不到 |
| employee 直接打 supervisor API | 403 |
| anonymous 打 BFF | 401 |
| Ragic H05 無法連線 | 場館候選顯示 not_connected |
| Smart Schedule 無法連線 | 今日班表顯示 not_connected |
| client telemetry 寫入失敗 | 主流程不能失敗 |
| 長標題/長 URL | UI 不可撐爆卡片 |

## 10. Replit 收尾順序

1. 套環境變數。
2. 套 migration。
3. 跑五個 npm gate。
4. 登入 1111。
5. 跑公告端到端查驗。
6. 跑員工端首頁與模糊搜尋查驗。
7. 跑主管端每個 route 查驗。
8. 查 `audit_logs`、`ui_events`、`client_errors` 是否有新 row。
9. 確認沒有 console 500。
10. 才能標記可交付。
