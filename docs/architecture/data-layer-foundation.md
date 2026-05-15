# Data Layer Foundation

日期：2026-04-24

本文件記錄目前資料層已依技術架構書鋪好的正式契約。這一層先定義 schema / repository / projection 邊界，不要求本地 mock mode 必須連正式 DB。

## 1. Schema Groups

位置：`shared/schema.ts`

已補強：

- `facilities`
- `sessions_index`
- `user_role_snapshots`
- `auth_audit_logs`
- `audit_logs`
- `ui_events`
- `integration_error_logs`
- `sync_job_runs`
- `bff_latency_logs`
- `employee_home_projection`
- `supervisor_dashboard_projection`
- `system_overview_projection`
- `source_snapshots`

保留既有：

- `users`
- `anomaly_reports`
- `notification_recipients`
- `handover_entries`
- `quick_links`
- `system_announcements`
- `portal_events`

## 2. Repository Rule

新架構不得在 route 內直接保管資料狀態。

目前已建立：

- `server/modules/telemetry/repository.ts`

規則：

- mock mode：使用 memory repository，讓本地無 DB 也能跑。
- real/neon mode：後續 Replit migration 完成後，替換為 DB-backed repository。
- route 不應知道資料到底存在 memory、PostgreSQL 或其他 store。

## 3. Projection Rule

首頁與 dashboard 不直接掃多張主資料表。

正式 projection tables：

- `employee_home_projection`
- `supervisor_dashboard_projection`
- `system_overview_projection`

目前 `/api/bff/employee/home` 先由 Replit data adapter 的 mock projection 提供。Replit 接線後，可以改由：

1. Replit data API 回傳 projection。
2. 本地 sync job 寫入 `employee_home_projection`。
3. BFF 從 projection table 讀取。

三種路線都必須維持同一個 `EmployeeHomeDto`。

同一規則也套用在：

- `SupervisorDashboardDto`：主管首頁 staffing、異常、任務、公告確認與交接概況。
- `SystemOverviewDto`：系統健康度、告警、整合失敗、稽核摘要。

目前主管與系統 BFF 先使用 mock projection，目的是讓前端角色首頁可以先穩定驗收版型與資料契約。Replit / Ragic / 其他資料源重連時，只替換 adapter 或 projection repository，不改前端 DTO 消費方式。

## 4. Snapshot Rule

外部來源原始資料先進 snapshot，再進 projection。

正式表：

- `source_snapshots`

可承接：

- schedule source
- booking source
- Ragic source
- LINE / Gmail / future external source

## 5. External Source Rule

Ragic、排班系統、預約 / 報名系統、LINE、Gmail、Replit 上既有資料接口，都屬於 **外部資料來源**。

正式規則：

- 外部來源不是本系統 PostgreSQL 主資料庫。
- 外部來源不得被前端直接呼叫。
- 外部來源不得在 Controller / BFF 直接呼叫。
- 外部來源只能透過 `server/integrations/*` adapter 存取。
- 外部來源資料若要進入本系統，需走：

```text
External Source -> Adapter -> source_snapshots -> projection tables -> BFF DTO -> Frontend
```

- 若外部來源暫時不可用，adapter 回 `SourceResult.status = unavailable | degraded | stale`，BFF 轉成 section fallback，不讓前端自行猜。
- Ragic 身份驗證也是 external auth source；登入成功後，本系統只保存 session / role snapshot，不把 Ragic 當成本系統 session store。

正式 / Replit 測試規則：

- `DATA_SOURCE_MODE=mock` 僅限本地無外網或 UI 開發 fallback。
- `DATA_SOURCE_MODE=test` 可使用正式外部 API，但允許 `DATABASE_PROFILE=mock`，適合 Replit 重連前做 smoke test。
- `DATA_SOURCE_MODE=real` 必須設定 `DATABASE_URL`，避免正式模式下不小心吃 memory / mock repository。
- 除 `shared/domain/facilities.ts` 的 LINE 群組 ID 對照表外，不得新增寫死外部資料。

## 6. Replit Migration Note

Replit pull 後要做：

```bash
npm run db:push
```

或後續改成 migration flow：

```bash
npm run db:migrate
```

在 migration 完成前，不要把 repository 強制切到 DB-backed implementation。

## 7. Known Transitional Debt

- `server/storage.ts` 仍是 legacy aggregate repository。
- `server/routes.ts` 仍有 legacy DB 操作。
- `audit_writer` 目前透過 telemetry repository memory sink，DB-backed sink 待 Replit migration 後接上。
- `portal_events` 是舊 analytics 表，未來會逐步收斂到 `ui_events`。
