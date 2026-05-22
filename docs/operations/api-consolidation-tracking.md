# API Consolidation Tracking

Generated: 2026-05-22

Status values:

- `canonical`: accepted owner for the current behavior.
- `forwarding`: legacy endpoint can safely delegate to a canonical handler with response parity.
- `retired-pending`: endpoint should stop receiving new consumers, but cannot be removed until usage is proven gone.
- `blocked-shape-mismatch`: not safe to forward because request/response shape or data authority differs.

## Legacy Residual

| Endpoint/module | Status | Canonical target | Notes |
| --- | --- | --- | --- |
| `server/modules/anomalies/legacy-routes.ts` | canonical | Existing anomaly legacy handlers | No BFF/system canonical exists yet. Public legacy shape differs from system monitoring. Keep as canonical until a dedicated anomaly BFF is introduced. |
| `server/modules/notification-recipients/legacy-routes.ts` | canonical | Existing notification-recipient handlers | CRUD surface has no replacement endpoint. Needs auth hardening before retirement, not forwarding. |
| `server/modules/external-proxy/legacy-routes.ts` | retired-pending | LINE / announcement / handover groups below | Mixed proxy surface. Individual endpoints require separate parity checks against 400LINE and local BFF DTOs. |

## Announcement Surfaces

| Endpoint/module | Status | Canonical target | Notes |
| --- | --- | --- | --- |
| `/api/announcements/*` | canonical | `server/modules/announcements/index.ts` | Local acknowledgement/read receipt authority. |
| `/api/announcement-overlays/*` | canonical | `server/modules/announcement-overlays/routes.ts` | Local per-user/per-announcement overlay authority. |
| `/api/admin/announcement-groups*` | canonical | `server/modules/announcement-groups/routes.ts` | LINE group configuration and fetch tests. |
| `/api/bff/employee/announcements*` | canonical | `server/modules/bff/employee-routes.ts` | Employee read projection. |
| `/api/announcement-candidates*` | blocked-shape-mismatch | 400LINE upstream candidate workflow | Candidate status/export DTOs do not match local acknowledgement or overlay DTOs. |
| `/api/facility-home/:groupId/announcements*` | blocked-shape-mismatch | Employee BFF announcement projection | Upstream group-scoped public proxy; auth and ID model differ. |

## Monitoring and Health Surfaces

| Endpoint/module | Status | Canonical target | Notes |
| --- | --- | --- | --- |
| `/api/bff/system/api-monitoring*` | canonical | `server/modules/system/api-monitoring-routes.ts` | API table, detail, and error-group status owner. |
| `/api/bff/system/health-overview` | canonical | `server/modules/system/routes.ts` | System summary owner. |
| `/api/health`, `/api/db-health`, `/api/line-health`, `/api/ragic-health` | canonical | `server/modules/system/api-monitoring-routes.ts` | Low-level probes, intentionally separate from BFF dashboards. |
| `/api/bff/system/action-monitoring` | blocked-shape-mismatch | API monitoring + telemetry audit | Action-level analytics, not a route health DTO. |
| `/api/bff/system/module-health/:moduleId` | blocked-shape-mismatch | Module registry health | Module-specific contract, not API row contract. |
| `/api/bff/system/project-monitoring*` | blocked-shape-mismatch | Project monitoring BFF | Project rollup, not API monitoring row contract. |
| `/api/bff/system/helper-status` | blocked-shape-mismatch | Helper/service configuration read model | External helper inventory, not health probe. |

## LINE Administration Surfaces

| Endpoint/module | Status | Canonical target | Notes |
| --- | --- | --- | --- |
| `/api/bff/system/linebot-management/*` | canonical | `server/modules/system/linebot-management-routes.ts` | System read model and sync orchestration. |
| `/api/bff/system/line-bot/*` | canonical | `server/modules/system/line-bot-routes.ts` | Authenticated 400LINE proxy for authority mutations. |
| `/api/bff/system/line-whitelist/*` | canonical | `server/modules/system/line-whitelist-routes.ts` | CMS/Neon shadow whitelist CRUD. |
| `/api/internal/service-health*` | retired-pending | `/api/bff/system/line-bot/service-status*` | Internal unauthenticated proxy read surface; keep only for machine consumers until usage is known. |
| `/api/internal/interview-users` | retired-pending | `/api/bff/system/line-bot/interview-users` | Internal unauthenticated read surface; do not forward until token expectations are confirmed. |

## Handover Surfaces

| Endpoint/module | Status | Canonical target | Notes |
| --- | --- | --- | --- |
| `/api/handover*` | canonical | `server/modules/handover/index.ts` | New operational handover write/read owner. |
| `/api/bff/employee/handover/*` | canonical | `server/modules/handover/index.ts` | Employee BFF projection for handover. |
| `/api/bff/supervisor/handovers` | canonical | `server/modules/bff/supervisor-routes.ts` | Supervisor projection. |
| `/api/portal/operational-handovers*` | blocked-shape-mismatch | `/api/handover*` | Similar storage table, but auth, status mapping, request body, and response DTO differ. Needs explicit parity adapter. |
| `/api/portal/handovers*` | blocked-shape-mismatch | none | Uses old `handoverEntries`, not `operationalHandovers`. |
| `/api/facility-home/:groupId/handover` | blocked-shape-mismatch | `/api/bff/employee/handover/*` | LINE upstream public proxy, group id authority differs from workbench session facility. |
| `/api/work-logs/handover*` | canonical | `server/modules/work-logs/routes.ts` | Lifeguard shift handover note, different domain object. |

## Object Upload and File Access

| Endpoint/module | Status | Canonical target | Notes |
| --- | --- | --- | --- |
| `/api/work-logs/upload` | canonical | `server/modules/work-logs/routes.ts` | Authenticated work-log upload. |
| `/api/storage/objects/*splat` | canonical | `server/modules/work-logs/routes.ts` | Authenticated object proxy with facility scoping. |
| `/api/uploads/request-url` | retired-pending | `/api/work-logs/upload` for work-log content only | Generic Replit upload helper may still be valid for non-work-log content. |
| `/objects/(.+)` | retired-pending | `/api/storage/objects/*splat` for protected content | Public object route must not be used for protected work-log objects. |
