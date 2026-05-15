# Replit Reconnect Guide

日期：2026-04-24

本專案目前保留 Replit 資料接口，但不在本地硬接正式資料。後續從 Replit pull 下來後，依本文件接線。

## 1. 必填環境變數

```env
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<Replit/Neon/PostgreSQL connection string>

REPLIT_DATA_ADAPTER_MODE=real
REPLIT_DATA_BASE_URL=<Replit data API base URL>
REPLIT_DATA_API_TOKEN=<Replit data API token>
REPLIT_DATA_TIMEOUT_MS=8000
```

如果正式外部來源已可用，再逐步打開：

```env
SCHEDULE_ADAPTER_MODE=real
BOOKING_ADAPTER_MODE=real
RAGIC_ADAPTER_MODE=real
STORAGE_ADAPTER_MODE=real
REDIS_URL=<Redis URL>
```

## 2. 接線原則

- 不改前端 component。
- 不改 BFF DTO shape。
- 不在 `server/routes.ts` 新增正式資料邏輯。
- 只補 real adapter implementation、env、secret。
- 若來源掛掉，adapter 回 `SourceResult` unavailable / degraded，不 throw 到前端白屏。
- Ragic、排班、預約、LINE、Gmail 都是外部資料來源；不可當成本系統 PostgreSQL 主資料庫使用。
- 外部來源資料要進系統時，走 adapter -> source snapshot -> projection -> BFF。

## 3. 第一個已保留接口

```ts
ReplitDataAdapter.getEmployeeHomeProjection(facilityKey)
```

目前使用者端 BFF：

```http
GET /api/bff/employee/home
```

本地 mock mode 會由 `mockReplitDataAdapter` 提供資料。

Replit real mode 會由 `realReplitDataAdapter` 呼叫：

```http
{REPLIT_DATA_BASE_URL}/api/bff/employee/home?facilityKey=...
Authorization: Bearer {REPLIT_DATA_API_TOKEN}
```

## 4. 後續要補的 real adapter

依優先順序：

1. `server/integrations/replit-data/real-adapter.ts`
2. `server/integrations/ragic/real-auth-adapter.ts`
3. `server/integrations/schedule/real-adapter.ts`
4. `server/integrations/booking/real-adapter.ts`
5. `server/integrations/storage/*` S3/R2/Replit Object Storage adapter
6. Redis cache/session adapter

## 5. 資料表同步

目前 `shared/schema.ts` 已包含正式資料層基線。Replit pull 後，在正式 DB 上同步 schema：

```bash
npm run db:push
```

同步前保持：

```env
DATA_SOURCE_MODE=mock
DATABASE_PROFILE=mock
```

同步後再切：

```env
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<正式連線>
```

## 6. 驗收

- `DATA_SOURCE_MODE=mock`：本地可無 DB / 無 Replit secret 啟動。
- `DATA_SOURCE_MODE=real`：缺 `DATABASE_URL` 時應立即失敗。
- `REPLIT_DATA_ADAPTER_MODE=real`：缺 Replit URL/token 時，BFF 回 503 並帶 source meta。
- 接上 Replit 後，前端 `/employee` 不改程式碼即可顯示正式資料。
