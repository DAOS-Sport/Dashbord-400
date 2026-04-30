# Auth 與 Telemetry 模組現況審計報告

範圍：read-only code archaeology。

備註：在 `docs/**/*.md` 搜尋 `v2.3`、`§10`、`§15`、`15.9`、`15.10` 未找到命中文本。本文的「v2.3 差異」章節以 repo 內可找到的對齊規範作為錨點：`docs/workbench-implementation-plan.md:162-179`、`docs/workbench-implementation-plan.md:237-246`、`docs/data-layer-foundation.md:131-138`。

## A. Auth 模組現況

### A.1 檔案盤點

`server/modules/auth/` 存在，檔案與實際行數：

| file | lines |
|---|---:|
| `server/modules/auth/context.ts` | 31 |
| `server/modules/auth/cookie.ts` | 31 |
| `server/modules/auth/index.ts` | 6 |
| `server/modules/auth/routes.ts` | 87 |
| `server/modules/auth/session-store.ts` | 99 |

Auth 邏輯也散在：

- `server/routes.ts:685-719`：legacy caller resolution、`requireSupervisor()`、`requireEmployee()`。
- `server/routes.ts:722-770`：legacy `POST /api/auth/ragic-login`。
- `server/integrations/ragic/auth-adapter.ts:1-27`：Ragic adapter interface。
- `server/integrations/ragic/index.ts:1-7`：依 `RAGIC_ADAPTER_MODE` 選擇 real/mock adapter。
- `server/integrations/ragic/real-auth-adapter.ts:1-110`：real Ragic auth。
- `server/integrations/ragic/mock-auth-adapter.ts:1-43`：mock Ragic auth。
- `server/integrations/ragic/facility-adapter.ts:1-116`：H05 facility candidates。
- `shared/auth/me.ts:1-55`：Auth DTO 與 Workbench role 型別。
- `shared/domain/facilities.ts:12-99`：Ragic department -> facility / area mapping。

Client 端 auth 相關檔案（搜尋 `client/**/*.ts(x)` 的 `/api/auth|useAuthMe|useLogin|useLogout|usePortalAuth|activeRole|activeFacility|grantedRoles|grantedFacilities|roleHomePath|localStorage`）：

- `client/src/App.tsx`
- `client/src/components/app-sidebar.tsx`
- `client/src/components/portal/PortalShell.tsx`
- `client/src/hooks/use-bound-facility.ts`
- `client/src/hooks/usePortalData.ts`
- `client/src/modules/employee/announcements/page.tsx`
- `client/src/modules/employee/documents/page.tsx`
- `client/src/modules/employee/employee-shell.tsx`
- `client/src/modules/employee/handover/page.tsx`
- `client/src/modules/employee/home/employee-home-page.tsx`
- `client/src/modules/employee/shift/page.tsx`
- `client/src/modules/employee/tasks/page.tsx`
- `client/src/modules/supervisor/handover/page.tsx`
- `client/src/modules/supervisor/reports/page.tsx`
- `client/src/modules/supervisor/settings/page.tsx`
- `client/src/modules/supervisor/tasks/page.tsx`
- `client/src/modules/workbench/login-page.tsx`
- `client/src/modules/workbench/role-switcher.tsx`
- `client/src/pages/portal/portal-analytics.tsx`
- `client/src/pages/portal/portal-handover.tsx`
- `client/src/pages/portal/portal-home.tsx`
- `client/src/pages/portal/portal-login.tsx`
- `client/src/pages/portal/portal-manage.tsx`
- `client/src/pages/portal/portal-review.tsx`
- `client/src/shared/auth/session.ts`
- `client/src/shared/telemetry/useTrackEvent.ts`

### A.2 Session 機制

Session truth 現況：cookie 只保存 opaque session id，session 內容存在 process memory `Map`。沒有 Redis session store，沒有 DB-backed session store。

- Cookie 讀取：`server/modules/auth/cookie.ts:15-16`
- Memory store：`server/modules/auth/session-store.ts:19-61`
- Request attach：`server/modules/auth/context.ts:15-26`
- `sessions_index` table 存在但不被 `server/modules/auth/session-store.ts` 使用：`shared/schema.ts:37-47`

Cookie 設定：

```ts
// server/modules/auth/cookie.ts:18-23
export const setSessionCookie = (res: Response, sessionId: string) => {
  const secure = isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${env.sessionCookieName}=${encodeURIComponent(sessionId)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${env.sessionTtlSeconds}`,
  );
};
```

Cookie clear：

```ts
// server/modules/auth/cookie.ts:26-31
export const clearSessionCookie = (res: Response) => {
  res.setHeader(
    "Set-Cookie",
    `${env.sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
};
```

Redis session store：未找到。搜尋 `Redis|connect-redis|ioredis|redis` 沒有 auth session store 實作；`createMemorySessionStore()` 是唯一註冊點：`server/modules/auth/routes.ts:11-14`。

`/api/auth/me` 存在：

```ts
// server/modules/auth/routes.ts:37-39
app.get("/api/auth/me", requireSession, (req, res) => {
  return res.json(req.workbenchSession);
});
```

`/api/auth/login` 存在：

```ts
// server/modules/auth/routes.ts:16-28
app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || req.body?.employeeNumber || "employee");
  const password = String(req.body?.password || "mock");
  const authResult = await container.integrations.ragicAuth.verifyCredentials(username, password);

  if (!authResult.data) {
    return res.status(401).json({ message: authResult.meta.fallbackReason, meta: authResult.meta });
  }

  const { sessionId, session } = await sessionStore.create(createSessionFromAuthUser(authResult.data));
  setSessionCookie(res, sessionId);
  return res.status(201).json(session);
});
```

`/api/auth/logout` 存在：

```ts
// server/modules/auth/routes.ts:30-35
app.post("/api/auth/logout", async (req, res) => {
  const sessionId = getSessionIdFromCookie(req.headers.cookie);
  if (sessionId) await sessionStore.destroy(sessionId);
  clearSessionCookie(res);
  return res.status(204).send();
});
```

Client 判斷登入方式：打 `/api/auth/me`，不讀 token。`useAuthMe()` 使用 React Query 呼叫 `/api/auth/me`：`client/src/shared/auth/session.ts:5-13`。`WorkbenchAuthGate` 依 `useAuthMe()` 的 `isError || !session` redirect `/login`：`client/src/App.tsx:292-307`。Portal guard 也透過 `usePortalAuth()`，而 `usePortalAuth()` 由 `useAuthMe()` 派生：`client/src/hooks/use-bound-facility.ts:33-52`。

### A.3 Ragic 整合

Ragic adapter 存在：`server/integrations/ragic/auth-adapter.ts:1-27`。實際選擇 real/mock：`server/integrations/ragic/index.ts:1-7`。

登入驗證核心邏輯：

```ts
// server/integrations/ragic/real-auth-adapter.ts:57-100
try {
  const url = employeeUrl();
  url.searchParams.set("where", `${RAGIC_QUERY_FID.employeeNumber},eq,${employeeNumber}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${env.ragicApiKey}`,
      Accept: "application/json",
    },
    signal: controller.signal,
  });

  if (!response.ok) {
    return sourceUnavailable("ragic-auth", `Ragic returned ${response.status}`, "RAGIC_HTTP_ERROR");
  }

  const json = await response.json() as Record<string, Record<string, unknown>>;
  const row = Object.values(json)[0];
  if (!row) {
    return sourceUnavailable("ragic-auth", "查無此員工編號", "RAGIC_EMPLOYEE_NOT_FOUND");
  }

  const expectedPhone = normalizePhone(row[RAGIC_KEY.mobile]);
  if (expectedPhone !== normalizePhone(phone)) {
    return sourceUnavailable("ragic-auth", "員工編號或手機不符", "RAGIC_INVALID_CREDENTIALS");
  }

  const status = String(row[RAGIC_KEY.status] || "").trim();
  if (status && status !== "在職") {
    return sourceUnavailable("ragic-auth", "員工非在職狀態", "RAGIC_EMPLOYEE_INACTIVE");
  }

  const departments = parseDepartments(row[RAGIC_KEY.department]);
  const title = String(row[RAGIC_KEY.title] || "");
  return sourceOk("ragic-auth", {
    userId: String(row[RAGIC_KEY.employeeNumber] || employeeNumber),
    displayName: String(row[RAGIC_KEY.name] || employeeNumber),
    employeeNumber: String(row[RAGIC_KEY.employeeNumber] || employeeNumber),
    title,
    department: departments.join(", "),
    departments,
    status,
    isSupervisor: isSupervisorTitle(title),
  });
}
```

Legacy route handler 也存在一條直接 Ragic login 邏輯：`server/routes.ts:722-770`。該 route 讀 env、清 `employeeCache`、呼叫 `lookupEmployee()`、比對手機與在職狀態，最後只回 profile JSON，不建立 `workbench_sid` session：`server/routes.ts:729-764`。

Ragic 欄位 mapping：

- 查詢 fid：`employeeNumber: "3000935"`，`server/integrations/ragic/real-auth-adapter.ts:6-8`
- 欄位 key：`員工編號`、`姓名`、`手機`、`部門`、`職稱`、`在職狀態`，`server/integrations/ragic/real-auth-adapter.ts:10-17`
- 角色推導：`isSupervisorTitle()` 用 `/主管|經理|組長|店長|館長|總監|協理|副理|副總/`，`server/integrations/ragic/real-auth-adapter.ts:19-20`
- Mock 版本把 `管理員` 也視為 supervisor：`server/integrations/ragic/mock-auth-adapter.ts:39-40`

Ragic credential env var names:

- `RAGIC_API_KEY`：`server/shared/config/env.ts:41`
- `RAGIC_HOST`：`server/shared/config/env.ts:42`
- `RAGIC_ACCOUNT_PATH`：`server/shared/config/env.ts:43`
- `RAGIC_EMPLOYEE_SHEET`：`server/shared/config/env.ts:44`
- `RAGIC_FACILITY_SHEET`：`server/shared/config/env.ts:45`
- `RAGIC_ADAPTER_MODE`：`server/shared/config/env.ts:29`

H05 facility candidate adapter:

- Ragic H05 keys：`部門名稱/部門/場館名稱/名稱`、`運營性質/營運性質`、`狀態/場館狀態/合約狀態`，`server/integrations/ragic/facility-adapter.ts:6-10`
- 只取 `operationType === "OT"` 且 `statusLabel !== "結束"`：`server/integrations/ragic/facility-adapter.ts:35-39`
- H05 URL 使用 `env.ragicFacilitySheet`，limit 1000：`server/integrations/ragic/facility-adapter.ts:83-90`

### A.4 角色與場館機制

`grantedRoles` / `activeRole` / `grantedFacilities` / `activeFacility` 存在於 DTO：`shared/auth/me.ts:3-11`。

Session record 直接 extends DTO：`server/modules/auth/session-store.ts:7-10`。計算方式：

```ts
// server/modules/auth/session-store.ts:63-83
export const createMockSession = (
  userId: string,
  displayName: string,
  isSupervisor = true,
  departments: string[] = [],
): Omit<SessionRecord, "issuedAt" | "lastActive"> => ({
  userId,
  displayName,
  grantedRoles: isSupervisor ? ["employee", "supervisor", "system"] : ["employee"],
  activeRole: isSupervisor ? "system" : "employee",
  grantedFacilities: resolveGrantedFacilities(isSupervisor, departments),
  activeFacility: resolveGrantedFacilities(isSupervisor, departments)[0] ?? "xinbei_pool",
  permissionsSnapshot: [
    "employee:home:read",
    "supervisor:dashboard:read",
    "supervisor:layout:update",
    "system:overview:read",
    "workbench:role:switch",
    "employee:facility:switch",
  ],
});
```

Ragic user -> session：`createSessionFromAuthUser()` 把 `user.isSupervisor ?? true` 傳入 `createMockSession()`：`server/modules/auth/session-store.ts:93-99`。

場館計算：

```ts
// server/modules/auth/session-store.ts:87-91
const resolveGrantedFacilities = (isSupervisor: boolean, departments: string[]) => {
  if (isSupervisor) return facilityLineGroups.map((facility) => facility.facilityKey);
  const granted = facilityKeysFromRagicDepartments(departments);
  return granted.length > 0 ? granted : ["xinbei_pool"];
};
```

Ragic department -> same area facilities：`facilityKeysFromRagicDepartments()` 先 match department alias，再取同 `area` 的所有 facility keys：`shared/domain/facilities.ts:74-90`。

Runtime `SYSTEM_ADMIN` sub-role：Module Registry type 有 `SYSTEM_ADMIN`：`shared/modules/types.ts:3-7`；registry validator 也列入：`shared/modules/registry.ts:1110-1120`。Workbench runtime role 沒有 `SYSTEM_ADMIN`，`WorkbenchRole = "employee" | "supervisor" | "system"`：`shared/auth/me.ts:1`。Auth route 允許切換的 `workbenchRoles` 只有 employee/supervisor/system：`server/modules/auth/routes.ts:9`、`server/modules/auth/routes.ts:76-85`。

### A.5 路由保護

Client routing 使用 Wouter，不是 TanStack Router。`client/src/App.tsx` 使用 `<Switch>`/`<Route>`/`<Redirect>`：`client/src/App.tsx:202-289`。

Workbench route guard 只擋未登入，沒有逐 route 比對 `activeRole`：

```tsx
// client/src/App.tsx:292-307
function WorkbenchAuthGate() {
  const { data: session, isLoading, isError } = useAuthMe();

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4f7fb]">
        <DreamLoader label="Dreams 登入狀態確認中" />
      </div>
    );
  }

  if (isError || !session) {
    return <Redirect to="/login" />;
  }

  return <WorkbenchRouter />;
}
```

Portal route guard 透過 `usePortalAuth()` 擋未登入：`client/src/App.tsx:86-99`。

角色切換 UI 只顯示 session granted roles：`client/src/modules/workbench/role-switcher.tsx:31-48`。

後端新架構 route middleware：

```ts
// server/modules/auth/context.ts:28-31
export const requireSession: RequestHandler = (req, _res, next) => {
  if (!req.workbenchSession) return next(new HttpError(401, "Authentication required", "AUTH_REQUIRED"));
  return next();
};
```

Legacy route middleware：

```ts
// server/routes.ts:701-719
function requireSupervisor(): import("express").RequestHandler {
  return async (req, res, next) => {
    const caller = await resolveCaller(req);
    if (!caller) return res.status(401).json({ message: "未授權：請重新登入" });
    if (caller.status && caller.status !== "在職") return res.status(403).json({ message: "員工已離職" });
    if (!caller.isSupervisor) return res.status(403).json({ message: "需主管權限" });
    (req as unknown as { caller: EmployeeProfile }).caller = caller;
    next();
  };
}

function requireEmployee(): import("express").RequestHandler {
  return async (req, res, next) => {
    const caller = await resolveCaller(req);
    if (!caller) return res.status(401).json({ message: "未授權：請重新登入" });
    if (caller.status && caller.status !== "在職") return res.status(403).json({ message: "員工已離職" });
    (req as unknown as { caller: EmployeeProfile }).caller = caller;
    next();
  };
}
```

Employee BFF routes require session and enforce facility grant for requested facility：`server/modules/bff/routes.ts:891-915`、`server/modules/bff/routes.ts:918-940`、`server/modules/bff/routes.ts:943-971`。Supervisor dashboard BFF does not use `requireSession`; it reads optional session and falls back to all facility groups: `server/modules/bff/routes.ts:1003-1013`。

Module registry API route protection:

- `/api/modules/registry` requires session but exposes technical registry to `activeRole === "system"`：`server/modules/registry/moduleRegistryController.ts:20-27`
- `/api/modules/navigation` requires session：`server/modules/registry/moduleRegistryController.ts:30-35`
- `/api/modules/health` requires session：`server/modules/registry/moduleRegistryController.ts:46-54`
- Debug `/api/system/module-registry` has TODO and no `requireSession` in signature: `server/modules/registry/moduleRegistryController.ts:69-74`

### A.6 與 v2.3 §10 規範的明顯差異

本 repo 未找到 `v2.3 §10` 原文；以下以 `docs/workbench-implementation-plan.md:162-179` 的 Auth / Session 收權要求對照。

1. 規範要求「實作 Redis session store」：`docs/workbench-implementation-plan.md:168`。現況唯一 session store 是 process memory `Map`：`server/modules/auth/session-store.ts:19-61`。
2. 規範要求 cookie 只存 opaque `session_id`：`docs/workbench-implementation-plan.md:169`。現況 cookie 確實只存 opaque id，但 session truth 不在 Redis/DB，而在 memory：`server/modules/auth/cookie.ts:18-23`、`server/modules/auth/session-store.ts:19-61`。
3. 規範要求 `/api/auth/me` 回 `userId/grantedRoles/activeRole/grantedFacilities/activeFacility/permissionsSnapshot`：`docs/workbench-implementation-plan.md:170-176`。現況 DTO 有這些欄位：`shared/auth/me.ts:3-11`，但實作直接回 `req.workbenchSession`：`server/modules/auth/routes.ts:37-39`，沒有 DB-backed snapshot 讀取。
4. 規範要求「不提供 `POST /api/auth/active-role`」：`docs/workbench-implementation-plan.md:178`。現況提供 `POST /api/auth/active-role`：`server/modules/auth/routes.ts:76-85`。
5. 規範要求「加 Origin / CSRF 防護」：`docs/workbench-implementation-plan.md:179`。現況 auth routes 沒有 Origin / CSRF check：`server/modules/auth/routes.ts:16-86`。
6. `sessions_index` / `auth_audit_logs` schema 已存在：`shared/schema.ts:37-69`，但 auth login/logout/session store 未寫入這兩張表：`server/modules/auth/routes.ts:16-35`、`server/modules/auth/session-store.ts:24-61`。
7. `SYSTEM_ADMIN` 只在 module registry type 中存在：`shared/modules/types.ts:3-7`；workbench runtime role 不包含 `SYSTEM_ADMIN`：`shared/auth/me.ts:1`。
8. `createSessionFromAuthUser()` 對 `isSupervisor` 預設 `true`：`server/modules/auth/session-store.ts:93-99`。當 Ragic adapter 沒提供 `isSupervisor` 時會授予 `employee/supervisor/system` 並將 `activeRole` 設成 `system`：`server/modules/auth/session-store.ts:71-72`。
9. New auth login 與 legacy `ragic-login` 共存：`server/modules/auth/routes.ts:16-28`、`server/routes.ts:722-770`。Legacy route 不建立 `workbench_sid` session：`server/routes.ts:757-764`。
10. Client route guard 只檢查有無 session，沒有針對 `/employee/*`、`/supervisor/*`、`/system/*` 做 per-route `activeRole` check：`client/src/App.tsx:202-307`。

## B. Telemetry 模組現況

### B.1 檔案盤點

`server/modules/telemetry/` 檔案與實際行數：

| file | lines |
|---|---:|
| `server/modules/telemetry/index.ts` | 6 |
| `server/modules/telemetry/repository.ts` | 70 |
| `server/modules/telemetry/routes.ts` | 69 |

Client 端 telemetry / event tracking / analytics 相關檔案（搜尋 `client/**/*.ts(x)` 的 `useTrackEvent|trackEvent\(|/api/telemetry|/api/portal/events|usePortalPageview|EVENT_TYPE_LABELS|module-events|ui-event-overview|PortalEventStats`）：

- `client/src/App.tsx`
- `client/src/hooks/usePortalData.ts`
- `client/src/modules/employee/employee-shell.tsx`
- `client/src/modules/employee/handover/page.tsx`
- `client/src/modules/employee/home/employee-home-page.tsx`
- `client/src/modules/supervisor/reports/api.ts`
- `client/src/modules/system/audit/api.ts`
- `client/src/modules/system/audit/page.tsx`
- `client/src/modules/system/raw-inspector/api.ts`
- `client/src/modules/workbench/role-shell.tsx`
- `client/src/pages/portal/portal-analytics.tsx`
- `client/src/shared/telemetry/useTrackEvent.ts`
- `client/src/types/portal.ts`

### B.2 事件寫入路徑

Workbench 客戶端事件 hook：

```ts
// client/src/shared/telemetry/useTrackEvent.ts:7-35
export const useTrackEvent = () => {
  const [location] = useLocation();
  const { data: session } = useAuthMe();

  return useCallback(
    (eventType: UiEventType, metadata: Record<string, unknown> = {}) => {
      apiPost("/api/telemetry/ui-events", {
        eventType,
        page: location,
        componentId: typeof metadata.moduleId === "string" ? metadata.moduleId : undefined,
        actionType: eventType,
        payload: {
          ...metadata,
          role: session?.activeRole,
          facilityKey: session?.activeFacility,
        },
        occurredAt: new Date().toISOString(),
      }).catch((error) => {
        apiPost("/api/telemetry/client-error", {
          message: error instanceof Error ? error.message : "Telemetry dispatch failed",
          page: location,
          componentId: typeof metadata.moduleId === "string" ? metadata.moduleId : undefined,
          occurredAt: new Date().toISOString(),
        }).catch(() => undefined);
      });
    },
    [location, session?.activeFacility, session?.activeRole],
  );
};
```

Global click capture also sends `/api/telemetry/ui-events` directly:

```ts
// client/src/App.tsx:313-327
useEffect(() => {
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const clickable = target?.closest<HTMLElement>("[data-widget-id], a, button");
    if (!clickable) return;
    const componentId = clickable.dataset.widgetId || clickable.getAttribute("href") || clickable.getAttribute("aria-label") || clickable.textContent?.trim().slice(0, 40);
    if (!componentId) return;
    apiPost("/api/telemetry/ui-events", {
      eventType: "CARD_CLICK",
      page: location,
      componentId,
      actionType: "click",
      payload: { tagName: clickable.tagName.toLowerCase() },
      occurredAt: new Date().toISOString(),
    }).catch(() => undefined);
  };
```

Workbench backend receive path:

```ts
// server/modules/telemetry/routes.ts:7-23
app.post("/api/telemetry/ui-events", async (req, res) => {
  const key = req.workbenchSession?.userId || req.ip || "anonymous";
  if (!allowTokenBucket(`ui-events:${key}`, 10, 1000)) {
    return res.status(429).json({ message: "Too many telemetry events" });
  }

  const event = req.body as UiEventDto;
  await container.repositories.telemetry.recordUiEvent({
    ...event,
    userId: req.workbenchSession?.userId,
    role: req.workbenchSession?.activeRole,
    facilityKey: req.workbenchSession?.activeFacility,
    receivedAt: new Date().toISOString(),
  });

  return res.status(202).json({ accepted: true });
});
```

Client error receive path:

```ts
// server/modules/telemetry/routes.ts:25-47
app.post("/api/telemetry/client-error", async (req, res) => {
  const error = req.body as ClientErrorDto;
  await container.repositories.telemetry.recordClientError({
    ...error,
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
    correlationId: error.correlationId,
    resultStatus: "success",
  });

  return res.status(202).json({ accepted: true });
});
```

Workbench event path:

`client/src/shared/telemetry/useTrackEvent.ts:7-35` or `client/src/App.tsx:313-327` -> `POST /api/telemetry/ui-events` (`server/modules/telemetry/routes.ts:7-23`) -> `container.repositories.telemetry.recordUiEvent` (`server/app/container/index.ts:3-10`) -> memory arrays in `server/modules/telemetry/repository.ts:34-60` -> no DB table.

Portal analytics path:

`client/src/hooks/usePortalData.ts:153-168` -> `POST /api/portal/events` (`server/routes.ts:1554-1580`) -> `storage.recordPortalEvent` (`server/storage.ts:381-384`) -> `portal_events` (`shared/schema.ts:330-340`)。

Portal pageview call sites:

- `client/src/hooks/usePortalData.ts:174-183`
- `client/src/components/portal/PortalShell.tsx:58-66`
- `client/src/pages/portal/portal-home.tsx:43-47` for `link_click`

### B.3 Memory Repository Fallback

Memory repository file：`server/modules/telemetry/repository.ts`。

Memory arrays:

```ts
// server/modules/telemetry/repository.ts:34-49
const uiEventMemory: StoredUiEvent[] = [];
const clientErrorMemory: StoredClientError[] = [];
const auditMemory: AuditEventInput[] = [];

export const createMemoryTelemetryRepository = (): TelemetryRepository => ({
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

Memory vs DB condition:

```ts
// server/modules/telemetry/repository.ts:62-70
export const createTelemetryRepository = (): TelemetryRepository => {
  if (env.databaseProfile === "mock" || env.dataSourceMode === "mock") {
    return createMemoryTelemetryRepository();
  }

  // DB-backed repository is intentionally reserved until migrations are applied on Replit.
  // Keeping the same interface lets the reconnect phase swap this implementation without route changes.
  return createMemoryTelemetryRepository();
};
```

DB-backed implementation：未找到。`auditLogs` / `uiEvents` / `clientErrors` schema 存在，但沒有 `db.insert(auditLogs)`、`db.insert(uiEvents)`、`db.insert(clientErrors)` 命中；搜尋結果只有 schema type 與 memory repository：`shared/schema.ts:453-519`、`server/modules/telemetry/repository.ts:34-70`。

Feature flag：`env.databaseProfile` / `env.dataSourceMode` 影響分支，但 real/non-mock 分支仍回 memory：`server/modules/telemetry/repository.ts:62-70`。

### B.4 資料表

`portal_events` schema：

```ts
// shared/schema.ts:330-347
export const portalEvents = pgTable("portal_events", {
  id: serial("id").primaryKey(),
  employeeNumber: text("employee_number"),
  employeeName: text("employee_name"),
  facilityKey: text("facility_key"),
  eventType: text("event_type").notNull(),
  target: text("target"),
  targetLabel: text("target_label"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortalEventSchema = createInsertSchema(portalEvents).omit({
  id: true,
  createdAt: true,
}).extend({
  eventType: z.enum(["pageview", "link_click", "announcement_open", "announcement_ack", "handover_create", "handover_report", "handover_claim", "layout_update", "widget_click", "search", "resource_create"]),
});
```

`audit_logs` 存在：

```ts
// shared/schema.ts:453-467
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

`ui_events` 存在：

```ts
// shared/schema.ts:477-490
export const uiEvents = pgTable("ui_events", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: text("user_id"),
  role: text("role"),
  facilityKey: text("facility_key"),
  page: text("page").notNull(),
  componentId: text("component_id"),
  actionType: text("action_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  traceId: text("trace_id"),
  correlationId: text("correlation_id"),
  sessionIdHash: text("session_id_hash"),
});
```

`client_errors` 也存在：`shared/schema.ts:500-519`。

對照 v2.3 §15.9 / §15.10：未找到 v2.3 原文，因此只能列現況欄位：

- `audit_logs` 現況欄位：`id`、`timestamp`、`actor_id`、`role`、`facility_key`、`action`、`resource`、`resource_id`、`payload`、`ip`、`user_agent`、`correlation_id`、`result_status`，`shared/schema.ts:453-467`。
- `ui_events` 現況欄位：`id`、`timestamp`、`user_id`、`role`、`facility_key`、`page`、`component_id`、`action_type`、`payload`、`trace_id`、`correlation_id`、`session_id_hash`，`shared/schema.ts:477-490`。
- `portal_events.metadata` 是 `text`，不是 `jsonb`：`shared/schema.ts:338`。`ui_events.payload` 與 `audit_logs.payload` 是 `jsonb`：`shared/schema.ts:462`、`shared/schema.ts:486`。

### B.5 事件分類

Workbench `UiEventType`：

- `PAGE_VIEW`：`shared/telemetry/events.ts:2`
- `NAV_CLICK`：`shared/telemetry/events.ts:3`
- `CARD_CLICK`：`shared/telemetry/events.ts:4`
- `VIEW_ALL_CLICK`：`shared/telemetry/events.ts:5`
- `ROLE_SWITCH_CLICK`：`shared/telemetry/events.ts:6`
- `FACILITY_SWITCH`：`shared/telemetry/events.ts:7`
- `SEARCH_SUBMIT`：`shared/telemetry/events.ts:8`
- `MODULE_HEALTH_VIEW`：`shared/telemetry/events.ts:9`
- `CHART_DRILLDOWN`：`shared/telemetry/events.ts:10`
- `FILTER_CHANGE`：`shared/telemetry/events.ts:11`
- `TOGGLE_PANEL`：`shared/telemetry/events.ts:12`
- `ACTION_SUBMIT`：`shared/telemetry/events.ts:13`

Portal `eventType` enum：

- `pageview`
- `link_click`
- `announcement_open`
- `announcement_ack`
- `handover_create`
- `handover_report`
- `handover_claim`
- `layout_update`
- `widget_click`
- `search`
- `resource_create`

來源：`shared/schema.ts:342-347`。

實際埋點呼叫點：

- `client/src/modules/employee/handover/page.tsx:153`：`ACTION_SUBMIT` / `handover-create`
- `client/src/modules/employee/handover/page.tsx:161`：`ACTION_SUBMIT` / `handover-complete`
- `client/src/modules/employee/home/employee-home-page.tsx:265`：`NAV_CLICK`
- `client/src/modules/employee/home/employee-home-page.tsx:533`：`ACTION_SUBMIT` / `handover-create`
- `client/src/modules/employee/home/employee-home-page.tsx:540`：`ACTION_SUBMIT` / `handover-complete`
- `client/src/modules/employee/home/employee-home-page.tsx:1466`：`NAV_CLICK`
- `client/src/modules/employee/employee-shell.tsx:170`、`client/src/modules/employee/employee-shell.tsx:237`：`NAV_CLICK`
- `client/src/modules/workbench/role-shell.tsx:101`：`NAV_CLICK`
- `client/src/modules/system/raw-inspector/api.ts:17-24`：`ACTION_SUBMIT`
- `client/src/App.tsx:320-327`：global `CARD_CLICK`
- `client/src/hooks/usePortalData.ts:178-180`：portal `pageview`
- `client/src/components/portal/PortalShell.tsx:62-64`：portal `pageview`
- `client/src/pages/portal/portal-home.tsx:43-47`：portal `link_click`

Server-side portal events：

- `server/modules/announcements/index.ts:48`：`announcement_ack`
- `server/modules/bff/routes.ts:961-969`：`search`
- `server/modules/handover/index.ts:166`：`handover_create`
- `server/modules/handover/index.ts:196`：`handover_report`
- `server/routes.ts:1053`、`server/routes.ts:1189`：`handover_create`
- `server/routes.ts:1253`：`handover_claim` or `handover_report`
- `server/routes.ts:1331`：`layout_update`
- `server/routes.ts:1437`：`resource_create`

Correlation / trace:

- Middleware creates or accepts `X-Correlation-Id` and writes it into response/header：`server/shared/telemetry/correlation.ts:6-11`
- Middleware registered globally：`server/index.ts:24-27`
- `UiEventDto` has optional `correlationId`：`shared/telemetry/events.ts:15-23`
- `ClientErrorDto` has optional `correlationId`：`shared/telemetry/events.ts:25-32`
- `ui_events` schema has `trace_id` and `correlation_id`：`shared/schema.ts:477-490`
- Client `useTrackEvent()` does not read response/header correlation id and does not set `correlationId`：`client/src/shared/telemetry/useTrackEvent.ts:13-23`
- Telemetry route stores body event as-is and adds user/role/facility/receivedAt; it does not copy `req.headers["x-correlation-id"]` into the event：`server/modules/telemetry/routes.ts:13-20`

### B.6 Module Registry 怎麼運作

`scripts/module-registry-check.ts`：

- imports registry and validators：`scripts/module-registry-check.ts:1-2`
- defines roles/status list：`scripts/module-registry-check.ts:4-5`
- counts `MODULE_REGISTRY` by `module.status`：`scripts/module-registry-check.ts:7-8`
- prints total、status counts、modules by role、homepage widgets、modules without BFF、legacy route modules：`scripts/module-registry-check.ts:21-55`

`scripts/module-smoke.ts`：

- imports `assertModuleRegistryValid()`、descriptor/nav/card/health helpers：`scripts/module-smoke.ts:3-10`
- validates descriptor id uniqueness, role presence, nav route presence：`scripts/module-smoke.ts:31-41`
- validates navigation/cards/health references and card statuses：`scripts/module-smoke.ts:43-52`
- asserts employee cannot see system routes and supervisor cannot see raw inspector：`scripts/module-smoke.ts:54-55`
- asserts employee navigation order：`scripts/module-smoke.ts:56-59`
- scans frontend for localStorage authority, direct external API calls, hardcoded nav lists：`scripts/module-smoke.ts:61-92`
- checks BFF and handover route registrations by text：`scripts/module-smoke.ts:94-104`
- prints descriptor counts and per-role health counts：`scripts/module-smoke.ts:106-112`

Module descriptor definition：`shared/modules/types.ts:111-130` for `ModuleDefinition`; descriptor projection in `shared/modules/descriptors.ts:121-148`。

Example registry entry for auth：

```ts
// shared/modules/registry.ts:51-83
{
  id: "auth",
  label: "Authentication and Session",
  description: "Workbench login, role/facility switching, legacy Ragic portal login, and session governance.",
  domainType: "core",
  status: partial,
  visibleRoles: ["employee", "supervisor", "system", "SYSTEM_ADMIN"],
  visibility: ["background_only", "system_only"],
  sourceOfTruth: "postgres",
  homepageWidget: false,
  priority: {},
  routes: [portalRoute("/portal/login", partial), roleRoute("system", "/login", partial)],
  apis: [
    api("POST", "/api/auth/login", "auth"),
    api("POST", "/api/auth/logout", "auth"),
    api("GET", "/api/auth/me", "auth"),
    api("GET", "/api/auth/facility-candidates", "auth", partial),
    api("POST", "/api/auth/active-facility", "auth"),
    api("POST", "/api/auth/active-role", "auth"),
    api("POST", "/api/auth/ragic-login", "auth", legacy),
  ],
```

Telemetry registry entry：

- `telemetry-audit` status `partial`：`shared/modules/registry.ts:740-746`
- APIs include `/api/telemetry/ui-events`、`/api/telemetry/client-error`、`/api/bff/system/ui-event-overview`、legacy `/api/portal/events`、`/api/portal/analytics`：`shared/modules/registry.ts:751-758`
- Data binding marks `ui_events` implemented, `audit_logs` partial, `portal_events` implemented, `bff_latency_logs` planned：`shared/modules/registry.ts:759-764`
- governance notes say audit writer exists but high-risk business writes still need full coverage：`shared/modules/registry.ts:767-768`

Registry 與 auth 互動：

- `/api/modules/*` endpoints use `requireSession` and `req.workbenchSession.activeRole/permissionsSnapshot`：`server/modules/registry/moduleRegistryController.ts:20-54`
- `getNavigationModules()` filters by role, employee order, permissions：`shared/modules/descriptors.ts:340-355`
- `canViewModule()` checks activeRole, grantedFacilities, permissions, enabled/stage：`shared/modules/descriptors.ts:413-423`

Registry 與 telemetry 互動：

- Module descriptors include `telemetryEvents` from registry：`shared/modules/descriptors.ts:142-145`
- `getModuleHealth()` sets `telemetryOk = module.telemetryEvents.length > 0` and reports missing telemetry event descriptors：`shared/modules/descriptors.ts:378-409`
- `telemetry-audit` itself is registered as a system module：`shared/modules/registry.ts:740-769`

`42 modules / 50 descriptors / 11 implemented` 的計算：

- `42 modules`：`MODULE_REGISTRY.length`，script prints `total: ${MODULE_REGISTRY.length}`：`scripts/module-registry-check.ts:21-28`。靜態 count：`shared/modules/registry.ts` 中 module `id:` 42 筆。
- `11 implemented`：`MODULE_REGISTRY.filter((module) => module.status === "implemented").length`：`scripts/module-registry-check.ts:7-8`、`scripts/module-registry-check.ts:27-28`。靜態 count：`status: implemented` 11 筆。
- `21 partial`：同一 count 函式，靜態 count：`status: partial` 21 筆。
- `50 descriptors`：`getModuleDescriptors()` returns base registry descriptors plus extra descriptors whose id does not already exist：`shared/modules/descriptors.ts:326-330`。靜態 count：42 registry ids + 8 extra descriptor id lines = 50。

本機執行 `npm run check:modules` 與 `npm run smoke:modules` 在目前 Codex Windows runtime 均 exit 1，只有 npm script header，沒有 TypeScript error output。對應 scripts 在 `package.json:12-13`。

### B.7 與 v2.3 §15 規範的明顯差異

本 repo 未找到 `v2.3 §15` 原文；以下以 `docs/workbench-implementation-plan.md:237-246` 與 `docs/data-layer-foundation.md:131-138` 對照。

1. 規範要求建立 `ui_events`、`audit_logs`：`docs/workbench-implementation-plan.md:243-244`。現況 schema 存在：`shared/schema.ts:453-490`，但 repository 未寫 DB，仍寫 memory：`server/modules/telemetry/repository.ts:34-70`。
2. `docs/data-layer-foundation.md:137` 記錄 `audit_writer` 目前透過 telemetry repository memory sink，DB-backed sink 待 Replit migration。現況 `recordAudit()` 寫 memory 並 `console.info`：`server/modules/telemetry/repository.ts:47-49`。
3. `docs/data-layer-foundation.md:138` 記錄 `portal_events` 是舊 analytics 表，未來收斂到 `ui_events`。現況 portal analytics 仍直接寫 `portal_events`：`server/routes.ts:1554-1575`、`server/storage.ts:381-384`。
4. `/api/telemetry/ui-events` 回 202 不阻塞 UI已存在：`server/modules/telemetry/routes.ts:7-23`。但該 endpoint 沒有 `requireSession`，匿名也可送，actor fields 可能 undefined：`server/modules/telemetry/routes.ts:7-20`。
5. `/api/telemetry/client-error` 已存在：`server/modules/telemetry/routes.ts:25-47`。但 `client_errors` table 未被寫入；`recordClientError()` 寫 memory：`server/modules/telemetry/repository.ts:43-45`。
6. `ui_events` schema 有 `trace_id` / `correlation_id`：`shared/schema.ts:487-488`。現況 client `useTrackEvent()` 不送 traceId/correlationId：`client/src/shared/telemetry/useTrackEvent.ts:13-23`。
7. Global correlation middleware 寫入 request header：`server/shared/telemetry/correlation.ts:6-11`。Telemetry route 沒把該 header merge 到 event：`server/modules/telemetry/routes.ts:13-20`。
8. Event taxonomy split：Workbench 使用 uppercase `UiEventType`：`shared/telemetry/events.ts:1-13`；Portal enum 使用 lowercase event types：`shared/schema.ts:342-347`。
9. `portal_events.metadata` 是 `text`：`shared/schema.ts:338`。`ui_events.payload` / `audit_logs.payload` 是 `jsonb`：`shared/schema.ts:462`、`shared/schema.ts:486`。
10. Module registry marks `ui_events` as implemented：`shared/modules/registry.ts:759-760`，但 telemetry repository has no DB-backed write path：`server/modules/telemetry/repository.ts:62-70`。

## C. 跨模組觀察

### C.1 Auth 與 Telemetry 的耦合點

Workbench telemetry actor/role/facility source：

- Client hook includes `session.activeRole` / `session.activeFacility` in payload：`client/src/shared/telemetry/useTrackEvent.ts:18-22`
- Server enriches event with `req.workbenchSession?.userId`、`activeRole`、`activeFacility`：`server/modules/telemetry/routes.ts:14-20`
- Client error audit uses same session fields：`server/modules/telemetry/routes.ts:35-44`

Portal legacy event actor source：

- Client sends `X-Employee-Number`、`X-Employee-Name`、`X-Facility-Key` headers：`client/src/hooks/usePortalData.ts:158-166`
- Server reads those headers and writes `portal_events`：`server/routes.ts:1554-1575`

Audit gap:

- `auth_audit_logs` schema exists：`shared/schema.ts:59-69`，but auth routes do not write it：`server/modules/auth/routes.ts:16-35`
- `audit_logs` schema exists：`shared/schema.ts:453-467`，but telemetry audit is memory-only：`server/modules/telemetry/repository.ts:47-49`
- `writeAudit()` exists but only logs `[audit:reserved]` and is not used by route code found in grep：`server/shared/telemetry/audit-writer.ts:21-25`

### C.2 Strangler Fig 進度

Auth module status：`partial`。

Evidence:

- Module registry declares `auth.status = partial`：`shared/modules/registry.ts:51-57`
- Registry data binding notes `sessions_index` partial and `auth_audit_logs` partial：`shared/modules/registry.ts:72-75`
- Session store is memory-only：`server/modules/auth/session-store.ts:19-61`
- `docs/workbench-implementation-plan.md:168-179` still lists Redis session, no active-role endpoint, CSRF/Origin hardening as target work; current code differs as in A.6.

Telemetry module status：`partial`。

Evidence:

- Module registry declares `telemetry-audit.status = partial`：`shared/modules/registry.ts:740-746`
- Registry data binding marks `audit_logs` partial and `bff_latency_logs` planned：`shared/modules/registry.ts:759-764`
- Construction map says `Telemetry / Audit | partial | UI events、client errors、audit | DB-backed telemetry 取代 memory repo`：`docs/CONSTRUCTION_MAP.md:82`
- Repository always returns memory implementation, even outside mock branch：`server/modules/telemetry/repository.ts:62-70`

### C.3 已知技術債清單

1. Two auth paths coexist: new `/api/auth/login` creates cookie session：`server/modules/auth/routes.ts:16-28`; legacy `/api/auth/ragic-login` validates Ragic profile but returns profile only：`server/routes.ts:722-770`。
2. `sessions_index` table exists but session store does not use DB：`shared/schema.ts:37-47`、`server/modules/auth/session-store.ts:19-61`。
3. `auth_audit_logs` table exists but login/logout routes do not write audit rows：`shared/schema.ts:59-69`、`server/modules/auth/routes.ts:16-35`。
4. `createSessionFromAuthUser()` defaults missing `isSupervisor` to `true`：`server/modules/auth/session-store.ts:93-99`。
5. Supervisor user gets `activeRole: "system"` by default：`server/modules/auth/session-store.ts:71-72`。
6. `SYSTEM_ADMIN` exists in module registry type but not in workbench runtime role：`shared/modules/types.ts:3-7`、`shared/auth/me.ts:1`。
7. `permissionSatisfied()` returns false when `requiredPermissions.length === 0`：`shared/modules/descriptors.ts:98-105`。This means modules with no required permissions can fail health permission checks.
8. `/api/system/module-registry` debug endpoint has TODO for `SYSTEM_ADMIN` but no `requireSession` in route signature：`server/modules/registry/moduleRegistryController.ts:69-74`。
9. `/api/bff/supervisor/dashboard` lacks `requireSession` and falls back to all facility groups when no session exists：`server/modules/bff/routes.ts:1003-1013`。
10. `WidgetTelemetryCapture` sends global `CARD_CLICK` for any `[data-widget-id], a, button` click：`client/src/App.tsx:313-327`。Explicit `useTrackEvent()` calls also exist in employee/workbench pages, creating possible duplicate event streams: `client/src/modules/employee/employee-shell.tsx:153-170`、`client/src/modules/workbench/role-shell.tsx:62-101`。
11. Portal analytics event actor fields are client-supplied headers, not session-derived：`client/src/hooks/usePortalData.ts:158-166`、`server/routes.ts:1556-1558`。
12. `portal_events` remains a legacy analytics table while `ui_events` exists but is not used by DB-backed telemetry repository：`docs/data-layer-foundation.md:138`、`server/modules/telemetry/repository.ts:62-70`。
