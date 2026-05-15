# DAOS 駿斯 API 整合規則

最後同步：2026-04-24

## 原則

所有外部資料來源一律透過 server adapter 或 legacy proxy 取得，前端不得直接呼叫外部 API。

唯一允許寫死的外部常數是 LINE 群組 ID 對照表，集中在 `shared/domain/facilities.ts`。

## 外部來源

- Ragic：員工資料與登入認證來源。
- LINE Bot Assistant：公告候選池與場館首頁資料。
- Smart Schedule Manager：排班總覽與面試授權。
- Portal Server DB：交接、常用網址、系統公告、事件追蹤。

## 環境變數

```bash
RAGIC_API_KEY=
RAGIC_HOST=ap7.ragic.com
RAGIC_ACCOUNT_PATH=xinsheng
RAGIC_EMPLOYEE_SHEET=/ragicforms4/13
RAGIC_FACILITY_SHEET=/ragicforms4/7

LINE_BOT_BASE_URL=https://line-bot-assistant-ronchen2.replit.app
SMART_SCHEDULE_BASE_URL=https://smart-schedule-manager.replit.app
EXTERNAL_API_TIMEOUT_MS=10000

DATABASE_URL=
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
```

本地開發可用：

```bash
DATA_SOURCE_MODE=test
DATABASE_PROFILE=mock
RAGIC_ADAPTER_MODE=mock
REPLIT_DATA_ADAPTER_MODE=real
```

這會測外部 API，但不要求正式 PostgreSQL。

## 已落地接線

- `server/integrations/ragic/real-auth-adapter.ts`：依員工編號查 Ragic，密碼欄位視為手機比對。
- `server/integrations/replit-data/real-adapter.ts`：依 `facilityKey -> LINE group id` 抓 LINE Bot Assistant 場館首頁。
- `server/integrations/schedule/real-adapter.ts`：抓 Smart Schedule Manager overview。
- `server/modules/bff/routes.ts`：`DATA_SOURCE_MODE=mock` 才使用本地 mock；`test` / `real` 走外部來源。
- legacy proxy routes 仍保留 `/api/announcement-*`、`/api/facility-home/*`、`/api/admin/overview`，並改由 env base URL 控制。

## 待拆模組

舊功能目前已先搬入 Workbench shell，下一步要逐一拆成正式 module：

- 公告候選池：`server/modules/announcements` + `client/src/modules/supervisor/announcements`
- 異常通報：`server/modules/anomalies` + `client/src/modules/supervisor/anomalies`
- 交接 / 常用網址 / 系統公告：`server/modules/portal`
- 排班總覽：`server/modules/schedules`
- Raw Inspector：`server/modules/integrations`
