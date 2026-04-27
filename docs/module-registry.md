# Module Registry

## Purpose

Module Registry is the shared inventory for the workbench. It tells frontend, backend, and future agents which module owns each page, API, table, integration, BFF section, and governance rule.

New work must check the registry first. If a capability is not registered, register it before adding UI, API, or database behavior.

## Why Register First

- Prevents new code from being attached to the wrong page or legacy route.
- Keeps `server/routes.ts` as a legacy boundary instead of a place for new business logic.
- Lets frontend and backend use the same module ownership map.
- Makes partial, mock, external, and planned surfaces visible instead of pretending they are complete.
- Gives BFF section keys a stable home before page widgets consume them.

## File Layout

The registry lives under `shared/modules/`:

- `ids.ts`: stable kebab-case module ids.
- `types.ts`: public registry types.
- `registry.ts`: `MODULE_REGISTRY`, lookup helpers, and `assertModuleRegistryValid()`.
- `index.ts`: barrel export for frontend, backend, and scripts.

Frontend-only convenience hooks live in `client/src/shared/modules/useModuleRegistry.ts`.

System debug routes live in `server/modules/registry/`.

## Module ID Rules

- Use stable kebab-case ids.
- Prefer domain names already used in routes, tables, or BFF sections.
- Do not rename ids casually; old route names belong in `legacy.oldNames` or `legacy.oldRoutes`.
- Do not collapse unrelated features into `dashboard`.
- Add a new id only when no existing module owns the behavior.

## Status Definitions

- `implemented`: implemented enough to be used as real product behavior.
- `partial`: implemented, but still missing a known contract, audit path, BFF path, or production hardening.
- `mock`: mock-only behavior.
- `external`: owned by an upstream system.
- `planned`: intentionally registered but not implemented.
- `legacy`: existing compatibility route, page, or storage path.
- `deprecated`: still registered but should not receive new work.

## Domain Types

- `core`: central business workflow.
- `derived`: projection, dashboard, or reporting layer.
- `support`: supporting feature used by core flows.
- `system`: system administration, telemetry, auth, or governance.
- `integration`: external source or adapter boundary.
- `legacy`: compatibility layer for old portal/admin behavior.

## Source Of Truth

- `postgres`: local database table is the current system of record.
- `external`: upstream system is authoritative.
- `projection`: derived local projection from other sources.
- `telemetry`: event/audit tables.
- `private`: system-only or sensitive operational data.
- `legacy`: old compatibility state.
- `none`: no real source exists yet.

## Adding A Module

1. Add the id to `shared/modules/ids.ts`.
2. Add one `ModuleDefinition` in `shared/modules/registry.ts`.
3. Fill roles, visibility, routes, APIs, data, integrations, BFF keys, telemetry, and governance.
4. If status is `planned`, include `governance.notes`.
5. Run `npm run check:modules`.
6. Update this document or `docs/module-registry-audit.md` if the change affects ownership.

## Registering Legacy Pages

Legacy pages stay in place. Add their paths under `routes` with:

- `kind: "legacy_admin"` for old admin pages.
- `kind: "legacy_portal"` for old portal routes.
- `status: "legacy"` or `partial` when the page has some current BFF/local data.

Do not delete old routes in this registry pass.

## Registering APIs

Every API binding must include method, path, kind, and status.

Use:

- `bff` for role-facing DTO endpoints.
- `crud` for local domain table operations.
- `proxy` for upstream passthroughs.
- `auth` for login/session/role/facility.
- `telemetry` for events/audit.
- `export` and `upload` for file surfaces.
- `legacy` for compatibility endpoints.

New business API code should go under `server/modules/*`, not `server/routes.ts`. The first Employee Home core module using this rule is `tasks`, which owns `/api/tasks` and is intentionally separate from `handover`.

## Registering Tables

Each table belongs to at least one module through `data`.

Set:

- `table`: exact database table name.
- `entity`: product/domain meaning.
- `source`: usually `postgres`, `projection`, or `telemetry`.
- `status`: actual implementation state.
- `notes`: required when the table is compatibility state or only partially wired.

`tasks` uses the dedicated `tasks` table. `handover` owns `handover_entries` and `operational_handovers`; do not reuse handover tables as task storage for new work.

## BFF Wiring Rules

Role home pages should consume BFF sections instead of fetching multiple APIs in page components.

Use these keys consistently:

- Employee core: `tasks`, `handover`, `announcements`, `shifts`, `shortcuts`.
- Employee planned/secondary: `bookingSnapshot`, `campaigns`, `documents`, `stickyNotes`, `qna`, `notifications`.
- Supervisor: `staffing`, `pendingAnomalies`, `incompleteTasks`, `announcementAcks`, `handoverOverview`, `settings`, `reports`.
- System: `health`, `observability`, `audit`, `alerts`, `integrationOverview`, `scheduleSnapshot`, `watchdogEvents`, `rawInspector`.

If a module has no BFF section yet, keep it registered and list future endpoints in `plannedEndpoints`.

`shifts` remains external/read-only through Smart Schedule or schedule projections. Do not add local shift write APIs unless the registry source of truth and governance are changed first.
