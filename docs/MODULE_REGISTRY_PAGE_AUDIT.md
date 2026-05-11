# Module Registry To Page Audit

Purpose: keep `shared/modules` aligned with real pages and prevent duplicate module IDs or hidden legacy entry points.

## Source Of Truth

| Concern | File |
|---|---|
| Module IDs | `shared/modules/ids.ts` |
| Business registry and integration metadata | `shared/modules/registry.ts` |
| Role-specific navigation/cards | `shared/modules/descriptors.ts` |
| Canonical workbench routes | `shared/navigation/workbench-routes.ts` |
| Runtime route mounting | `client/src/App.tsx` |
| Automated contract checks | `scripts/module-unit-tests.ts`, `scripts/module-smoke.ts`, `scripts/workbench-governance-check.ts` |
| Mother-system classification | `shared/modules/architecture.ts`, `/system/function-relations` |

## Critical Module/Page Alignment

| Module | Canonical Page / Component | Backend Surface | Status |
|---|---|---|---|
| `employee-home` | `client/src/modules/employee/home/employee-home-page.tsx` | `/api/bff/employee/home` | active |
| `lifeguard-home` | `client/src/modules/lifeguard/home/page.tsx` | `/api/bff/lifeguard/home` | active |
| `lifeguard-water-quality` | `client/src/modules/lifeguard/operation-detail-page.tsx` | `/api/bff/lifeguard/water-quality` | active |
| `lifeguard-coach-dive` | `client/src/modules/lifeguard/operation-detail-page.tsx` | `/api/bff/lifeguard/coach-dive` | active |
| `lifeguard-cleanup` | `client/src/modules/lifeguard/operation-detail-page.tsx` | `/api/bff/lifeguard/cleanup` | active |
| `lifeguard-lane-issues` | `client/src/modules/lifeguard/operation-detail-page.tsx` | `/api/bff/lifeguard/lane-issues` | active |
| `lifeguard-lost-and-found` | `client/src/modules/lifeguard/operation-detail-page.tsx` and `/employee/lost-and-found` reuse | `/api/bff/lifeguard/lost-and-found` | active |
| `lifeguard-lane-rentals` | `client/src/modules/lifeguard/operation-detail-page.tsx` | `/api/bff/lifeguard/lane-rentals` | active readonly |
| `supervisor-dashboard` | `client/src/modules/supervisor/dashboard-page.tsx` | `/api/bff/supervisor/dashboard` | active |
| `supervisor-lifeguard-overview` | `client/src/modules/supervisor/lifeguard-overview/page.tsx` | `/api/bff/supervisor/lifeguard-overview` | active |
| `system-function-relations` | `client/src/modules/system/function-relations/page.tsx` | front-end only architecture map | active |
| `system-topology` | `client/src/pages/system-topology.tsx` | front-end only topology config | active |
| `system-lifeguard-audit` | `client/src/modules/system/lifeguard-audit/page.tsx` | `/api/bff/system/lifeguard-audit` | active |
| `parking` | `client/src/pages/admin/parking/*` wrapped by supervisor shell | `/api/parking/*` | legacy page reused, workbench route active |
| `counter-log` | `client/src/pages/admin/work-logs/*` wrapped by supervisor shell | `/api/work-logs/admin/*` | legacy page reused, workbench route active |
| `lane-rentals` | `client/src/pages/admin/lane-rentals.tsx` wrapped by supervisor shell | `/api/lane-rentals/*` | legacy page reused, workbench route active |
| `courts` | `client/src/pages/courts/*` wrapped by employee/supervisor frames | `/api/courts/*` | legacy page reused, workbench route active |
| `announcement-groups` | `client/src/modules/supervisor/announcement-groups/page.tsx` | `/api/admin/announcement-groups` | active; API path remains admin compatibility |

## Rules

- A business capability gets one canonical module ID.
- Every module must belong to exactly one mother-system group through `shared/modules/architecture.ts`.
- School-specific courts routes are pages, not modules.
- Parking sub-tabs are pages, not separate sidebar modules unless explicitly needed for registry health.
- Old page files under `client/src/pages/admin/*` may remain as implementation components, but their official entry must be `/supervisor/*`.
- `App.tsx` must not import or render `AppSidebar` or `SidebarProvider`.
- Topology and home drawers must use canonical module IDs.
- A module without BFF binding must be background-only, integration, legacy, external or deprecated; otherwise it is treated as suspicious and fails governance checks.

## Mother-System Groups

| Group | Purpose |
|---|---|
| `entry-identity` | Login, role, facility, home shells, sessions, role snapshots and legacy user compatibility. |
| `employee-content` | Employee daily content, resources, training, notes, checkins, search and placeholder/not-connected cards. |
| `lifeguard-workflows` | Lifeguard operation modules, supervisor lifeguard overview and IT lifeguard audit. |
| `supervisor-operations` | Parking, counter log, lane rentals, courts, tasks, handover, anomalies and reports. |
| `announcements` | System announcements, LINE group bindings, review/summary, recipients, notifications and Q&A. |
| `system-governance` | Function relations, topology, health, telemetry audit, raw inspector, watchdog and BFF projections. |
| `integrations` | LINE Bot, schedule, Ragic, Gmail and integration sync jobs. |
| `portal-legacy` | Legacy portal surfaces, local upload/export compatibility and deprecated widget layout storage. |

## Current Known Exceptions

| Exception | Reason | Cleanup Path |
|---|---|---|
| `client/src/pages/admin/*` components still exist | reused implementation wrapped in supervisor workbench shell | remove only after equivalent `client/src/modules/supervisor/*` pages fully replace them |
| API paths such as `/api/admin/announcement-groups` remain | backend compatibility and existing client service names | migrate later behind BFF aliases, then deprecate admin API names |
| `analytics` and `operations` module IDs remain | compatibility with earlier registry taxonomy | keep redirected until report/operations modules are fully renamed |

## Verification

```bash
npm run check:modules
npm run check:workbench-governance
npm run smoke:modules
```
