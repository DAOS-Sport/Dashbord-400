# BFF 技術規範

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[bff-reference-map|BFF Reference Map]] / [[cleanup-backlog|清洗 backlog]]

這份規範給人類與 LLM 共用。任何 BFF、DTO、UI section、模組 registry 的改寫都必須照這份順序做，避免把資料流重新散回 page-local fetch、legacy route 或未註冊端點。

## 0. Non-Negotiable Rules

- 任何新功能先回答三欄：角色、RAGIC / 資料庫、功能 / 需求 / 用途。
- UI 不直接呼叫外部服務；外部服務一律經 server adapter / BFF 正規化。
- BFF 是頁面 contract，不是資料庫 schema；前端只依 DTO 與 section status render。
- 寫入不可只回 `success: true`；必須定義 query invalidation、projection refresh、audit / telemetry。
- 新 route、新 API、新資料表、新 integration 都必須回填 `shared/modules` registry，並重跑 `npm run docs:obsidian`。
- 不把 secret、token、connection string、private payload 寫進 docs、fixture、console log 或 response body。

## 1. Layer Ownership

| Layer | Owner | Can Do | Must Not Do |
| --- | --- | --- | --- |
| UI Page / Component | `client/src/modules/**` | Render BFF DTO, handle interaction state, invalidate queries after writes | Direct external fetch, direct DB model assumption, secret handling |
| Shared DTO / Domain | `shared/domain/**`, `shared/bff/**` | Define stable frontend-facing contracts | Leak raw DB rows or external provider payloads |
| BFF Route | `server/modules/bff/**` or owning server module | Compose data for one role/page/workflow | Mix unrelated domains into one endpoint without registry owner |
| Adapter / Integration | `server/integrations/**`, owning integration module | Normalize external service failures and payloads | Let provider-specific shape reach UI directly |
| Storage / Repository | `server/storage.ts`, domain repository | Read/write Postgres with domain semantics | Be called from frontend or expose table rows as UI contract |
| Registry / Docs | `shared/modules/**`, `docs/obsidian/**` | Declare module ownership, routes, APIs, data, BFF, UX logic | Drift from actual mounted routes or endpoints |

## 2. Endpoint Design

- Use resource-oriented REST names: `GET /api/bff/{role}/{surface}`, `POST /api/{domain}/{resource}`, `PATCH /api/{domain}/{resource}/:id`.
- `GET` is read-only and idempotent. Do not mutate cache, audit state, or permissions from `GET` except read telemetry when explicitly registered.
- `POST` creates or performs a command with a new record / audit trail.
- `PATCH` updates a subset or status transition.
- `DELETE` is only allowed for reversible or truly disposable records. For whitelist / permission modules, prefer status disable or expiry over deletion.
- BFF endpoints should be role or surface scoped, not generic all-purpose aggregators.
- Legacy endpoints can remain, but they must be marked `legacy` in registry and routed through a canonical module.

## 3. BFF Section Envelope

All page sections should use the shared envelope shape from `shared/bff/envelope.ts`:

| Field | Meaning |
| --- | --- |
| `status` | `ok`, `stale`, `unavailable`, or `degraded` |
| `data` | The DTO payload or `null` when unavailable |
| `meta.lastSyncAt` | Last trusted source timestamp |
| `meta.errorCode` | Machine-readable fallback / failure code |
| `meta.fallbackReason` | Human-readable reason suitable for operator UI |

Status rules:

- `ok`: source is connected and payload is current.
- `stale`: cached or old projection is shown; UI should show a quiet stale marker.
- `degraded`: partial data is shown; UI should show which source is unavailable when useful.
- `unavailable`: no usable data; UI should render empty/error state without crashing.

## 4. DTO Shape Rules

- DTO names describe UI meaning, not table names: `AnnouncementSummary`, `HomeCardDto`, `ModuleHealthDto`.
- Optional fields should be optional only when UI can render without them.
- Dates crossing the BFF boundary should be ISO strings or already formatted labels, never raw `Date` objects.
- IDs must be stable across refresh. For merged sources, prefix IDs by source: `line-`, `portal-`, `employee-`.
- Mappers live next to the BFF/domain service that owns the contract.
- Do not pass raw Ragic, LINE, CWA, Gemini, OpenAI, Google Apps Script, or Smart Schedule payloads to UI.

## 4a. Cross-Section Visual Consistency

- 同一 DTO 在不同 section 使用時，視覺最小單元必須來自同一個 shared component。
- 公告卡片統一用 `AnnouncementCard`；任務列表列統一用 `TaskRow`；IT 狀態列統一用 `DenseRow`。
- Page layer 不得重新實作同一 entity 的 badge hierarchy、title/summary/body layout、primary/secondary action order。
- Registry `bff.sharedComponents` 必須列出此 section 使用的 shared visual unit；尚未導入者進 [[cleanup-backlog]]。
- Phase A 元件抽取時先抽 shared visual unit，再替換 employee / supervisor / system 頁面，不反向從頁面複製樣式。

## 5. Read Flow

1. Resolve role and active facility/session.
2. Read canonical local data from storage/repository.
3. Read external data through adapter / integration service.
4. Normalize each source into shared DTOs.
5. Merge, de-dupe, sort, and apply overlays in the BFF service.
6. Return `BffSection<T>` or page DTO with section envelopes.
7. Register the endpoint and section key in the module registry.
8. Re-generate `docs/obsidian`.

## 6. Write Flow

1. Validate request body with schema / explicit parser.
2. Authorize role and facility scope.
3. Execute domain command through owning server module.
4. Persist only through storage/repository or owning service.
5. Append audit / telemetry when the action changes permission, state, or external visibility.
6. Return updated DTO or minimal command result with affected IDs.
7. Invalidate frontend query / refresh BFF section.
8. Update registry and module page if new API, table, event, or behavior exists.

## 6a. Audit Envelope

任何改變 permission、狀態、外部可見性、通知送出、資料刪除/停用的寫入都必須寫 audit envelope。

| Field | Required | Meaning |
| --- | --- | --- |
| `who.actorId` | yes | Current session user id. |
| `who.role` | yes | Current active role. |
| `who.facilityKey` | when scoped | Active or target facility key. |
| `when.occurredAt` | yes | ISO timestamp generated server-side. |
| `action` | yes | Stable machine action, e.g. `OPS_REFRESH_CACHE`. |
| `resource.type` | yes | Domain resource name, e.g. `system.operations`. |
| `resource.id` | when available | Target id. |
| `before` | for update/delete | Minimal safe snapshot before change; no secrets. |
| `after` | for update/create | Minimal safe snapshot after change; no secrets. |
| `reason` | for operator commands | Human reason, min length defined by command schema. |
| `result.status` | yes | `pending`, `success`, `partial`, or `failed`. |

Current storage target is telemetry/audit repository or `audit_logs` equivalent. If a module cannot write audit yet, registry `telemetry.auditRequired=true` plus cleanup-backlog entry is mandatory.

## 7. Auth, Role, And Facility Scope

- Employee UI can only receive employee-safe DTO fields.
- Supervisor endpoints can include operational summaries, but not system-only secrets or raw integration payloads.
- System endpoints can show configured/missing status, never secret values.
- `SYSTEM_ADMIN` actions should be explicit in registry `editableBy` and audit-required when permission-affecting.
- Facility-scoped data must normalize `facilityKey` once at the BFF/service boundary.
- Every new authenticated BFF owner needs either a live `smoke:auth-bff` read-only case or a static unit guard explaining why live smoke is unsafe.
- Auth smoke minimum is anonymous `401`, wrong role `403`, owning role `200`; destructive POST endpoints stay static/unit-tested unless a safe fixture exists.

## 8. External Source Rules

| Provider | Required BFF Behavior |
| --- | --- |
| RAGIC | Map candidate identity fields explicitly: name, userId / lineUserId, phone, department, source table. |
| LINE_BOT_ASSISTANT | Proxy through server; expose access status and normalized message/whitelist DTOs only. |
| SMART_SCHEDULE_MANAGER | Treat as external schedule source; cache or mark unavailable when disconnected. |
| CWA | Cache weather and degrade quietly when key/API is missing. |
| Gmail / Google / AI providers | Never expose raw error body or token; map to operator-safe status. |
| POSTGRES / NEON | Storage/repository owns writes; BFF owns UI projection shape. |

## 9. UI/UX Contract For BFF Consumers

- Every BFF-backed UI section must render loading, ready, empty, degraded, unavailable, and disabled states.
- Buttons that trigger writes need loading and disabled states until the mutation settles.
- Error feedback appears near the affected control or section, not only as a global toast.
- Required states are not prose-only: registry `bff.uiStates` must enumerate the exact states and `npm run check:ui-states` must find source evidence.
- Freshness is not page-defined: registry `bff.freshness` declares `realtime`, `5min`, `1hour`, `daily`, or `manual`; UI should render `FreshnessIndicator` when last sync is visible.
- Empty / loading / error / degraded states should come from shared design-system components: `EmptyState`, `LoadingState`, `ErrorState`, `DegradedState`.
- Page title text should come from module registry display labels or route manifest; hardcoded corrupted titles are blocked by `npm run check:title-binding`.
- Visual density budgets: employee/lifeguard cards should generally be >= 96px tall touch-friendly cards; supervisor rows/panels should balance scan and action density; IT dense rows should generally stay <= 48px unless expanded.
- System/IT screens should be dense and scannable: status chips, tables, filters, and action controls over decorative cards.
- Employee/lifeguard screens should be mobile-first with clear touch targets and no hidden hover-only actions.
- Do not make BFF-backed operational tools into landing pages.

## 10. Registry Requirements

Every BFF-affecting change must update the owning module page source in `shared/modules`:

- `routes`: mounted UI route or legacy route.
- `apis`: BFF / CRUD / proxy / telemetry endpoint.
- `data`: table, entity, source, status.
- `integrations`: provider, purpose, status.
- `bff`: section key and planned endpoints.
- `telemetry`: page/action/card/audit event expectations.
- `governance`: owner role, editable roles, readonly roles, approval rule.

## 11. LLM Change Protocol

When an LLM modifies BFF or UI, it should follow this exact checklist:

1. Find the module page in `docs/obsidian/modules`.
2. Read [[bff-reference-map]] for endpoint and section ownership.
3. Confirm the three intake fields: role, RAGIC / database, purpose.
4. Patch shared DTO / mapper before patching UI.
5. Keep external calls server-side.
6. Update registry if route/API/data/integration/telemetry changes.
7. Run `npm run docs:obsidian`.
8. Run gates: `npm run check:modules`, `npm run check:workbench-governance`, `npm run check:ui-states`, `npm run check:title-binding`, `npm run smoke:modules`, `npm run smoke:auth-bff`, `npm run type-check`, `npm run build`.
9. Report remaining warnings in [[cleanup-backlog]] instead of hiding them.

## 12. Required Gates

| Gate | Purpose |
| --- | --- |
| `npm run docs:obsidian` | Regenerate module docs, BFF map, and this governance set. |
| `npm run check:modules` | Validate registry coverage and module status. |
| `npm run check:workbench-governance` | Catch route / registry / governance drift. |
| `npm run check:ui-states` | Verify registry uiStates/freshness and source evidence for adopted BFF sections. |
| `npm run check:title-binding` | Block corrupted title text and list hardcoded h1 candidates for cleanup. |
| `npm run smoke:modules` | Catch UI/BFF contract regressions. |
| `npm run smoke:auth-bff` | Catch authenticated BFF 401 / 403 / 200 regressions without touching production data. |
| `npm run type-check` | Catch DTO and TypeScript contract drift. |
| `npm run build` | Catch production bundling/runtime compile issues. |
