# Audit Log Write Path Verification

Date: 2026-04-30
Task: Phase 0 T0.1 from `MASTER_CONSTRUCTION_PLAN.md`
Mode: read-only audit

## Baseline Dirty List

`git status -s` before this audit showed an already dirty worktree with many modified and untracked files. The scoped baseline relevant to this task included existing modifications to:

- `server/modules/telemetry/repository.ts`
- `server/modules/telemetry/routes.ts`
- `server/shared/config/env.ts`
- `shared/schema.ts`
- `scripts/module-smoke.ts`
- `docs/audits/`

This task only adds `docs/audits/audit-log-write-verification.md`.

## A. Telemetry Repository 實作現況

### A.1 Factory Branch Logic

`server/modules/telemetry/repository.ts:350-355`

```ts
export const createTelemetryRepository = (): TelemetryRepository => {
  if (env.databaseProfile === "mock" || env.dataSourceMode === "mock") {
    return createMemoryTelemetryRepository();
  }

  return createPostgresTelemetryRepository(db);
};
```

`server/app/container/index.ts:3-10` wires the application container to `createTelemetryRepository()`:

```ts
import { createTelemetryRepository } from "../../modules/telemetry/repository";

export const createAppContainer = () => ({
  repositories: {
    telemetry: createTelemetryRepository(),
  },
});
```

### A.2 Memory Branch

`server/modules/telemetry/repository.ts:80-90`

```ts
async recordUiEvent(event) {
  uiEventMemory.push(event);
},

async recordClientError(error) {
  clientErrorMemory.push(error);
},

async recordAudit(event) {
  auditMemory.push(event);
  console.info("[audit:memory]", JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
},
```

### A.3 DB Branch

`createPostgresTelemetryRepository()` exists at `server/modules/telemetry/repository.ts:212`.

`recordAudit()` writes to the real table at `server/modules/telemetry/repository.ts:256-273`:

```ts
async recordAudit(event) {
  try {
    await database.insert(auditLogs).values({
      actorId: event.actorId ?? null,
      role: event.role ?? null,
      facilityKey: event.facilityKey ?? null,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId ?? null,
      payload: toJsonObject(event.payload),
      ip: null,
      userAgent: null,
      correlationId: event.correlationId ?? null,
      resultStatus: event.resultStatus ?? "success",
    });
  } catch (err) {
    console.error("[telemetry:audit_logs:write_failed]", err, event);
  }
},
```

### A.4 Branch Answer

For `databaseProfile === "mock"` or `dataSourceMode === "mock"`:

- `recordAudit()` uses the memory branch.
- No `audit_logs` row is written.

For `databaseProfile !== "mock"` and `dataSourceMode !== "mock"`:

- `recordAudit()` uses `createPostgresTelemetryRepository(db)`.
- `recordAudit()` calls `database.insert(auditLogs).values(...)`.

The literal `databaseProfile === "production"` / `"replit"` values do not exist in the current type. Current allowed values are `mock | local | test | neon` at `server/shared/config/env.ts:3`.

## B. recordAudit 呼叫點盤點

Search performed:

```txt
Get-ChildItem -Path server,shared,scripts -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'recordAudit\('
```

Raw matches:

| file:line | kind | note |
|---|---|---|
| `server/modules/telemetry/repository.ts:70` | interface | `TelemetryRepository.recordAudit` declaration |
| `server/modules/telemetry/repository.ts:88` | implementation | memory repository |
| `server/modules/telemetry/repository.ts:256` | implementation | Postgres repository |
| `server/modules/telemetry/routes.ts:44` | caller | `/api/telemetry/client-error` route |

### B.1 Actual Caller

`server/modules/telemetry/routes.ts:32-53`

```ts
app.post("/api/telemetry/client-error", async (req, res) => {
  const error = req.body as ClientErrorDto;
  const correlationId = getCorrelationId(req, error.correlationId);
  await container.repositories.telemetry.recordClientError({
    ...error,
    correlationId,
    userId: req.workbenchSession?.userId,
    role: req.workbenchSession?.activeRole,
    facilityKey: req.workbenchSession?.activeFacility,
    receivedAt: new Date().toISOString(),
  });

  await container.repositories.telemetry.recordAudit({
    actorId: req.workbenchSession?.userId,
    role: req.workbenchSession?.activeRole,
    facilityKey: req.workbenchSession?.activeFacility,
    action: "CLIENT_ERROR_REPORTED",
    resource: "telemetry.client-error",
    payload: { message: error.message, page: error.page, componentId: error.componentId },
    correlationId,
    resultStatus: "success",
  });
```

| file:line | 觸發條件 | payload 摘要 | 是否在 try/catch 內 |
|---|---|---|---|
| `server/modules/telemetry/routes.ts:44` | `POST /api/telemetry/client-error` | `action=CLIENT_ERROR_REPORTED`, `resource=telemetry.client-error`, `payload={ message, page, componentId }`, session actor fields if available | route itself has no try/catch; repository catches DB write failures at `server/modules/telemetry/repository.ts:256-273` |

### B.2 Phase 0.1c 五棒呼叫點

No direct `recordAudit(` call was found in the current code paths for:

- quick_links create/update
- employee_resources create/update
- operational_handovers create/update/report
- system_announcements create/update
- tasks create/update/status

Observed metadata helper use without `recordAudit()`:

| scope | file:line | observation |
|---|---|---|
| operational_handovers create | `server/routes.ts:1185` | uses `withEmployeeCreateMetadata(...)` before `storage.createOperationalHandover(...)` |
| operational_handovers update | `server/routes.ts:1239` | uses `withUpdateMetadata(...)` before `storage.updateOperationalHandover(...)` |
| operational_handovers report | `server/routes.ts:1266` | uses `withUpdateMetadata(...)` before `storage.updateOperationalHandover(...)` |
| quick_links create | `server/routes.ts:1397` | uses `withCreateMetadata(...)` before `storage.createQuickLink(...)` |
| quick_links update | `server/routes.ts:1427` | uses `withUpdateMetadata(...)` before `storage.updateQuickLink(...)` |
| employee_resources create | `server/routes.ts:1487` | uses `withEmployeeCreateMetadata(...)` before `storage.createEmployeeResource(...)` |
| employee_resources update | `server/routes.ts:1531` | uses `withUpdateMetadata(...)` before `storage.updateEmployeeResource(...)` |
| system_announcements create | `server/routes.ts:1585` | uses `withCreateMetadata(...)` before `storage.createSystemAnnouncement(...)` |
| system_announcements update | `server/routes.ts:1606` | uses `withUpdateMetadata(...)` before `storage.updateSystemAnnouncement(...)` |
| tasks update | `server/modules/tasks/index.ts:142` | uses `withUpdateMetadata(...)` before `storage.updateTask(...)` |
| tasks status | `server/modules/tasks/index.ts:163` | uses `withUpdateMetadata(...)` before `storage.updateTask(...)` |

`server/modules/tasks/index.ts:94-123` creates tasks manually with metadata-shaped fields (`source`, `inputSource`, `createdByUserId`, `createdByName`, `createdByRole`) but does not call `recordAudit()`.

### B.3 Audit Writer Utility

`server/shared/telemetry/audit-writer.ts:1-21` defines reserved audit writer types and `writeAudit()`, but current grep found no caller outside that file.

`writeAudit()` currently logs to console:

```ts
export const writeAudit = async (event: AuditEventInput): Promise<void> => {
  console.info("[audit:reserved]", JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  }));
};
```

## C. audit_logs Schema 對齊

`shared/schema.ts:529-542`

```ts
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  actorId: text("actor_id"),
  role: text("role"),
  facilityKey: text("facility_key"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  correlationId: text("correlation_id"),
  resultStatus: text("result_status").default("success").notNull(),
});
```

| column | type | nullable | default | current DB branch mapping |
|---|---|---|---|---|
| `id` | serial | no | auto | omitted |
| `timestamp` | timestamp | no | `now()` | omitted |
| `actor_id` | text | yes | none | `event.actorId ?? null` |
| `role` | text | yes | none | `event.role ?? null` |
| `facility_key` | text | yes | none | `event.facilityKey ?? null` |
| `action` | text | no | none | `event.action` |
| `resource` | text | no | none | `event.resource` |
| `resource_id` | text | yes | none | `event.resourceId ?? null` |
| `payload` | jsonb | yes | none | `toJsonObject(event.payload)` |
| `ip` | text | yes | none | `null` |
| `user_agent` | text | yes | none | `null` |
| `correlation_id` | text | yes | none | `event.correlationId ?? null` |
| `result_status` | text | no | `"success"` | `event.resultStatus ?? "success"` |

The only required non-default fields are `action` and `resource`. The current direct caller at `server/modules/telemetry/routes.ts:44-53` provides both.

## D. Replit 環境變數依賴

### D.1 Env Parsing

`server/shared/config/env.ts:1-24`

```ts
export type DataSourceMode = "mock" | "test" | "real";
export type DatabaseProfile = "mock" | "local" | "test" | "neon";

export const env = {
  dataSourceMode: pick(read("DATA_SOURCE_MODE"), ["mock", "test", "real"] as const, "mock"),
  databaseProfile: pick(read("DATABASE_PROFILE"), ["mock", "local", "test", "neon"] as const, "mock"),
  databaseUrl: read("DATABASE_URL"),
};
```

Defaults:

- `DATA_SOURCE_MODE` defaults to `mock`.
- `DATABASE_PROFILE` defaults to `mock`.
- `DATABASE_URL` is optional at parse time.

### D.2 DB Runtime Config

`server/shared/db/profile.ts:11-28`

```ts
export const getDatabaseRuntimeConfig = (): DatabaseRuntimeConfig => {
  if (env.databaseUrl) {
    return {
      profile: env.databaseProfile,
      connectionString: env.databaseUrl,
      isMockConnection: false,
    };
  }

  if (isRealDataMode || env.databaseProfile === "neon") {
    throw new Error("DATABASE_URL must be set when DATA_SOURCE_MODE=real or DATABASE_PROFILE=neon");
  }

  return {
    profile: env.databaseProfile,
    connectionString: MOCK_DATABASE_URL,
    isMockConnection: true,
  };
};
```

`server/db.ts:8-13` creates a Drizzle connection from this runtime config and warns when `DATABASE_URL` is missing.

### D.3 Conditions Required For Audit DB Writes

For `recordAudit()` to write `audit_logs`, all of these must be true:

1. `DATA_SOURCE_MODE` must not be `mock`.
2. `DATABASE_PROFILE` must not be `mock`.
3. `DATABASE_URL` must be set if using `DATA_SOURCE_MODE=real` or `DATABASE_PROFILE=neon`.
4. Code must actually call `container.repositories.telemetry.recordAudit(...)`.

Example Replit-like setting that selects DB branch:

```txt
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<Replit Postgres / Neon URL>
```

## E. 結論

### E.1 Phase 0.1c 五棒在 Replit 上跑時 audit_logs 是否真的會有 row？

Answer: **No for the five domain write paths as currently wired.**

Reason:

- The DB-backed audit repository exists and can write `audit_logs`.
- The factory will choose that DB branch when `DATA_SOURCE_MODE !== mock` and `DATABASE_PROFILE !== mock`.
- But current grep found no `recordAudit()` caller in the Phase 0.1c five domain write paths.
- The only direct business caller is `/api/telemetry/client-error`, not quick links, employee resources, operational handovers, system announcements, or tasks.

### E.2 Does any route currently write audit_logs?

Answer: **Conditionally yes.**

`POST /api/telemetry/client-error` will write an `audit_logs` row if:

- telemetry repository is in DB branch, and
- `audit_logs` table exists, and
- DB connection succeeds.

The repository catches write failures and logs `[telemetry:audit_logs:write_failed]`; it does not throw.

### E.3 Minimal changes required to make Phase 0.1c five棒 produce audit rows

Do not apply in this read-only task. Minimal future changes:

1. Add a shared audit write path for domain routes, preferably through `container.repositories.telemetry.recordAudit(...)` or a wrapper around it.
2. Thread `AppContainer` or an audit writer into the legacy write routes in `server/routes.ts`, where quick links, employee resources, operational handovers, and system announcements currently write.
3. Add `recordAudit()` calls after successful domain writes:
   - `QUICK_LINK_CREATED`
   - `QUICK_LINK_UPDATED`
   - `EMPLOYEE_RESOURCE_CREATED`
   - `EMPLOYEE_RESOURCE_UPDATED`
   - `OPERATIONAL_HANDOVER_CREATED`
   - `OPERATIONAL_HANDOVER_UPDATED`
   - `OPERATIONAL_HANDOVER_REPORTED`
   - `SYSTEM_ANNOUNCEMENT_CREATED`
   - `SYSTEM_ANNOUNCEMENT_UPDATED`
   - `TASK_CREATED`
   - `TASK_UPDATED`
   - `TASK_STATUS_UPDATED`
4. Preserve non-blocking behavior: audit write failures must not fail the primary domain write.
5. Add smoke coverage so domain write routes cannot regress to metadata-only without audit.

## F. Halt / Out-of-Scope Findings

### F.1 Halt Reason

None.

### F.2 Out-of-Scope Findings

1. `server/shared/telemetry/audit-writer.ts:17-21` still logs `[audit:reserved]` and is not wired to the telemetry repository.
2. `server/modules/tasks/index.ts:94-123` creates tasks with metadata fields but does not use `withCreateMetadata()` and does not write audit.
3. `server/modules/telemetry/routes.ts:58-70` exposes `/api/bff/system/ui-event-overview` and `/api/telemetry/module-events` without `requireSession` / `requireRole`; auth hardening is outside this T0.1 audit.
4. `shared/modules/registry.ts:290`, `shared/modules/registry.ts:432`, and related module registry entries still describe some audit write paths as planned even though the DB-backed repository now exists. The remaining gap is caller coverage, not table/repository existence.
