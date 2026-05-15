# Backend Foundation Map

日期：2026-04-24

本文件記錄目前已鋪好的底層架構邊界。後續開發必須沿用這些入口，不要再把資料來源、DB、外部 API、UI DTO 直接寫進 legacy route 或前端 component。

## 1. Runtime Config

位置：

- `server/shared/config/env.ts`
- `.env.example`

用途：

- 統一讀取 `DATA_SOURCE_MODE`
- 統一讀取 `DATABASE_PROFILE`
- 統一讀取各 adapter mode
- 統一讀取 Replit data source 接線資訊

正式資料接線不得散落在 module 裡，必須從 env/config 進入。

## 2. DB Profile

位置：

- `server/shared/db/profile.ts`
- `server/db.ts`

規則：

- `DATA_SOURCE_MODE=mock` 或 `DATABASE_PROFILE=mock` 可在沒有 `DATABASE_URL` 時啟動。
- `DATA_SOURCE_MODE=real` 或 `DATABASE_PROFILE=neon` 必須提供 `DATABASE_URL`。
- Controller / BFF 不可直接建立 DB connection。
- 所有資料存取後續應移到 module repository。

## 3. Route Boundary

位置：

- `server/app/http/register-routes.ts`
- `server/app/http/cors.ts`
- `server/routes.ts`

規則：

- 新架構 route 從 `registerNewArchitectureRoutes()` 進入。
- 舊 `server/routes.ts` 保留 legacy route，但不再新增新功能。
- CORS 不得再使用 wildcard 搭配 credentials。
- cookie session 上線前，所有狀態改寫 API 需補 Origin / CSRF 防護。

## 4. App Container

位置：

- `server/app/container/index.ts`
- `server/integrations/index.ts`

用途：

- 集中建立 adapter。
- module 從 container 取 integration。
- 後續可替換成 Awilix，但目前先用手寫 composition root，避免加新依賴。

## 5. Integration Boundary

位置：

- `server/integrations/replit-data/*`
- `server/integrations/schedule/*`
- `server/integrations/booking/*`
- `server/integrations/ragic/*`
- `server/integrations/storage/*`

規則：

- 每個外部來源至少有 `adapter.ts` interface。
- mock implementation 可讓本地與初期 UI 先跑通。
- real implementation 只在 Replit reconnect 階段補上。
- Service / BFF / Controller 不可直接呼叫外部 URL。
- Ragic、排班、預約、LINE、Gmail、Replit data API 都屬於外部資料來源，不是本系統資料庫。
- 外部資料來源必須經 adapter，再依需要寫 source snapshot / projection。

## 6. Replit Data Adapter

位置：

- `server/integrations/replit-data/adapter.ts`
- `server/integrations/replit-data/mock-adapter.ts`
- `server/integrations/replit-data/real-adapter.ts`

用途：

- 保留 Replit 上既有資料接口。
- 本地以 mock adapter 跑通。
- Replit pull 後設定 `REPLIT_DATA_ADAPTER_MODE=real`、`REPLIT_DATA_BASE_URL`、`REPLIT_DATA_API_TOKEN` 即可接線。

目前第一個接線點：

- `getEmployeeHomeProjection(facilityKey)`
- 對應 BFF：`GET /api/bff/employee/home`

## 7. Shared Infrastructure

位置：

- `server/shared/cache/*`
- `server/shared/errors/*`
- `server/shared/security/*`
- `server/shared/telemetry/*`
- `server/shared/logging/*`
- `server/shared/observability/*`

用途：

- cache-aside
- token bucket rate-limit
- HTTP error
- audit writer scaffold
- correlation id
- health check result

這些目前是基線 scaffold，後續可接 Redis、PostgreSQL audit logs、OpenTelemetry collector。

## 8. Module Registry

位置：

- `server/modules/register.ts`
- `server/modules/*/index.ts`

已保留 module：

- auth
- users
- portal
- announcements
- anomalies
- schedules
- checkins
- tasks
- dashboard
- telemetry
- system
- integrations
- bff

規則：

- 新業務功能只能落在 module 內。
- 舊功能被維護時，逐步從 `server/routes.ts` 搬到對應 module。
- 每個 module 後續補齊 controller / service / repository / dto / mapper / policy。

## 9. Data Layer

資料層基線見：

- `docs/data-layer-foundation.md`

目前已在 `shared/schema.ts` 補上 session、audit、ui events、integration logs、source snapshots 與 role-specific projection tables。mock mode 不要求本地 DB；Replit migration 完成後再切 DB-backed repository。
