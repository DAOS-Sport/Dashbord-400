# Workbench Permission Matrix

This matrix is the operator-facing map for role access. The source of truth is code, not this document:

- Route ownership: `shared/navigation/workbench-routes.ts`
- Module visibility and cards: `shared/modules/descriptors.ts`
- Session role state: `server/modules/auth/session-store.ts`
- Route guards: `server/modules/*/routes.ts`, `server/routes.ts`

## Role Surfaces

| Role | Shell | Primary Prefixes | User Intent | Must Not Access |
|---|---|---|---|---|
| `employee` | Employee workbench | `/employee/*` | Daily staff work, handover, files, courts preview/edit, lost-and-found self report | `/system/*`, supervisor-only management |
| `lifeguard` | Lifeguard shell | `/lifeguard/*` | Mobile-first lifeguard operations, log records, and shared handover | Parking, supervisor reports, system raw data |
| `supervisor` | Supervisor workbench | `/supervisor/*` | Operations control, facility status, approvals, parking, courts, and handover | System raw inspector and registry administration |
| `system` | System workbench | `/system/*` plus selected observer surfaces | Audit, telemetry, module registry, integration health | Public member flows unless explicitly routed |

## Current Navigation Contract

| Role | Navigation Modules |
|---|---|
| `employee` | `employee-home`, `announcements`, `handover`, `activity-periods`, `employee-resources`, `employee-training`, `lifeguard-lost-and-found`, `courts`, `knowledge-base-qna` |
| `lifeguard` | `lifeguard-home`, `lifeguard-water-quality`, `lifeguard-coach-dive`, `lifeguard-cleanup`, `lifeguard-lane-issues`, `lifeguard-lost-and-found`, `lifeguard-lane-rentals`, `lifeguard-log`, `handover` |
| `supervisor` | `supervisor-dashboard`, `facilities`, `parking`, `lane-rentals`, `courts`, `announcements`, `announcement-groups`, `handover`, `employee-training` |
| `system` | `system-control-center`, `system-watchdog`, `system-operations`, `system-insights`, `system-governance`, `linebot-management`, `helper-status`, `line-whitelist` |

## Write Permissions By Domain

| Domain | Employee | Lifeguard | Supervisor | System | Audit Expectation |
|---|---:|---:|---:|---:|---|
| Employee handover | create/update own work surface | create/update as lifeguard role where routed | review/manage | observe through audit | `OPERATIONAL_HANDOVER_*`, `HANDOVER_ENTRY_*` |
| Employee resources / docs | read; selected create where enabled | read | manage | observe | `EMPLOYEE_RESOURCE_*` |
| Courts | preview/search/create/edit in employee shell | readonly through lifeguard lane-rentals | manage/import/edit/delete | audit only | Courts routes record actor/action |
| Parking | no official entry | no official entry | manage vehicles/plans/contracts/payments | observe where registry exposes | Parking payment/contract actions must remain supervisor scoped |
| Announcement groups | preview announcements only | preview shared announcements | CRUD LINE group binding | audit only | `ANNOUNCEMENT_GROUP_*` / route audit events |
| Lifeguard photo modules | lost-and-found self report only | create operational records | observe and claim/dispose lost items | audit/export | `LIFEGUARD_*` |
| System registry/function relations/raw inspector | none | none | none | read/inspect | telemetry/audit logs |

## Guard Rules

- `requireSession` is the base gate for workbench APIs.
- `requireRole("supervisor", "system")` protects supervisor BFF/management APIs.
- `requireRole("system")` protects raw inspector, telemetry audit, and system registry APIs.
- Lifeguard operation writes require `lifeguard` or `system`, except lost-and-found upload/report which allows `employee`.
- Employees must not manage LINE group bindings, parking settings, or system registry.

## Acceptance Criteria

- `npm run check:workbench-governance` passes.
- `npm run unit:modules` and `npm run smoke:modules` pass.
- No supervisor canonical route starts with `/admin/`, `/courts/`, `/analytics`, or `/operations`.
- No App runtime imports `AppSidebar` or `SidebarProvider`.
