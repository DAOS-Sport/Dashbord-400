# API Inventory - Phase 0

Generated on 2026-05-22 from the current worktree. This is a read-only inventory; no business logic was changed.

## Scope and Coverage

- Endpoint definitions found: 304
- Scanned route-pattern files under `server/modules`: 33
- Explicit registration files reviewed: `server/routes.ts`, `server/modules/register.ts`, `server/app/http/register-routes.ts`
- Endpoint-bearing non-*routes*.ts files included for completeness: `server/modules/announcements/index.ts`, `server/modules/auth/legacy-ragic-auth.ts`, `server/modules/handover/index.ts`, `server/modules/registry/moduleRegistryController.ts`, `server/replit_integrations/object_storage/routes.ts`
- Files with no direct `app.METHOD` endpoint definitions: `server/app/http/register-routes.ts`, `server/modules/bff/routes.ts`, `server/modules/register.ts`

Data-source labels are inferred from imports and handler body usage. `Neon via storage/db` means the route calls the local storage/repository/database layer, which may still have mock/fallback behavior depending on runtime configuration.

## Registration Map

- `server/routes.ts` delegates to `registerApiHub` in `server/modules/api-hub/index.ts`.
- `server/modules/api-hub/index.ts` installs CORS, starts the Ragic cache, creates the app container, registers all canonical route modules, blocks direct work-log upload access, then mounts legacy and dynamically imported feature routes.
- `server/app/http/register-routes.ts` is retained as historical reference; new entrypoint registration should go through API Hub.
- `server/modules/register.ts` registers module metadata only; it does not directly mount Express endpoints.

## Suspected Duplicate Groups

| Functional group | Canonical endpoint recommendation | Endpoints/modules to converge | Convergence risk |
| --- | --- | --- | --- |
| Legacy residual routes | No single canonical endpoint exists yet. Suggested canonical ownership: anomalies -> future `/api/bff/system/anomalies/*`; notification recipients -> future notification BFF/admin module; external announcement/facility proxy -> announcement/LINE/handover modules below. | `server/modules/anomalies/legacy-routes.ts`, `server/modules/external-proxy/legacy-routes.ts`, `server/modules/notification-recipients/legacy-routes.ts` | Not direct duplicates as a set. They are unauthenticated or inline-auth legacy surfaces with different DTOs. `external-proxy` is actively proxying 400LINE/facility-home shapes, while anomalies and notification recipients use local storage. Do not retire blindly; first map consumers by frontend search and access logs. |
| Announcement surfaces | Local acknowledgement/overlay state should stay in `/api/announcements/*` and `/api/announcement-overlays/*`; LINE group ingestion/admin should stay in `/api/admin/announcement-groups*`; employee read projections should prefer `/api/bff/employee/announcements*`. | Legacy `/api/announcement-dashboard/*`, `/api/announcement-candidates*`, `/api/announcement-reports/*`, `/api/facility-home/:groupId/announcements*` from `external-proxy/legacy-routes.ts` after parity against BFF/announcement-group shapes. | High. The three modern modules are adjacent but not equivalent: groups configure LINE sources, overlays store per-announcement user state, acknowledgements store read receipts. Legacy candidate endpoints expose 400LINE upstream candidate workflows and exports with different IDs/status names. |
| Monitoring and health surfaces | `/api/bff/system/api-monitoring` for API table/error-group UI; `/api/bff/system/health-overview` for system summary; keep `/api/health`, `/api/db-health`, `/api/line-health`, `/api/ragic-health` only as low-level probes. | Dashboard-level overlap across `/api/bff/system/action-monitoring`, `/api/bff/system/module-health/:moduleId`, `/api/bff/system/project-monitoring*`, `/api/bff/system/helper-status`, `/api/bff/system/control-center`, `/api/bff/system/integration-overview`. | Medium. These endpoints are not response-compatible. They share observability intent but differ by granularity: probe, module, project, helper, action/audit, and dashboard aggregate. Convergence should be UI-by-UI, not mechanical path forwarding. |
| LINE administration surfaces | `/api/bff/system/linebot-management/*` as the system dashboard/read model; `/api/bff/system/line-bot/*` as the authenticated 400LINE proxy for authority mutations; `/api/bff/system/line-whitelist/*` as CMS shadow whitelist CRUD. | Candidate duplicate read endpoints: linebot-management whitelist snapshot/comparison vs line-whitelist list/candidates; line-bot service-status vs linebot-management services/overview; internal `/api/internal/service-health*` and `/api/internal/interview-users` should remain machine/internal or be hidden behind Hub. | Medium-high. There are two authorities: 400LINE upstream and CMS/Neon shadow. Mutating endpoints cannot be forwarded to read-model endpoints. Compare DTO fields (`lineUserId`, `featureAccess`, `diffStatus`, `ragicMatched`, service `status`) before deprecating. |
| Handover surfaces | New operational handover module: `/api/handover*` plus employee BFF `/api/bff/employee/handover/*`. Supervisor read projection remains `/api/bff/supervisor/handovers`. | Legacy portal handover endpoints `/api/portal/handovers*`, `/api/portal/operational-handovers*`, and LINE facility-home proxy `/api/facility-home/:groupId/handover` after parity. Do not merge lifeguard shift handover under `/api/work-logs/handover*`; it is a different domain object. | High. Portal routes include old `handoverEntries` and operational handovers; new module uses `operationalHandovers` with BFF DTOs and image upload. Auth differs (`requireEmployee/requireSupervisor` vs `requireSession`) and field names differ (`reportNote`, `dueDate`, status mapping). |
| Object upload and file access | Workbench/work-log uploads should use `/api/work-logs/upload` and `/api/storage/objects/*splat` because they enforce employee auth and facility scoping. | `/api/uploads/request-url`, `/objects/(.+)`, and direct `/uploads/*` should not be used for protected work-log content. | Medium. Replit object-storage endpoints are generic/public and may be needed by non-work-log features. Static `/uploads/work-logs` is already explicitly blocked in `server/routes.ts`. |

## Endpoint Inventory

### server/app/http/register-routes.ts

No direct Express endpoint definitions in this file.

### server/modules/announcement-groups/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/announcement-groups` | deps.requireSupervisor() | LINE proxy/LINE authority + Neon via storage/db | query facilityKey, isActive | json DTO/entity |
| POST | `/api/admin/announcement-groups` | deps.requireSupervisor() | LINE proxy/LINE authority + Neon via storage/db | body; schema insertFacilityAnnouncementGroupSchema | status 400/201/409/500 |
| DELETE | `/api/admin/announcement-groups/:id` | deps.requireSupervisor() | LINE proxy/LINE authority + Neon via storage/db | params id; schema idParamSchema | status 400/404; json {ok} |
| PATCH | `/api/admin/announcement-groups/:id` | deps.requireSupervisor() | Neon via storage/db | params id; body; schema idParamSchema | status 400/404; json DTO/entity |
| POST | `/api/admin/announcement-groups/:id/test-fetch` | deps.requireSupervisor() | LINE proxy/LINE authority + Neon via storage/db + memory/cache | params id; schema idParamSchema | status 400/404/502; json DTO/entity |
| GET | `/api/integrations/announcement-groups/messages` | deps.requireEmployee() | LINE proxy/LINE authority | schema groupQuerySchema | status 400/403/502; json DTO/entity |

### server/modules/announcement-overlays/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/announcement-overlays/:id/hide` | deps.requireEmployee() | Neon via storage/db | params id; schema announcementIdSchema | status 400; json DTO/entity |
| POST | `/api/announcement-overlays/:id/note` | deps.requireEmployee() | Neon via storage/db | params id; body; schema announcementIdSchema, noteBodySchema | status 400; json DTO/entity |
| POST | `/api/announcement-overlays/:id/pin` | deps.requireEmployee() | Neon via storage/db | params id; body; schema announcementIdSchema, pinBodySchema | status 400; json DTO/entity |
| POST | `/api/announcement-overlays/:id/unhide` | deps.requireSupervisor() | Neon via storage/db | params id; schema announcementIdSchema | status 400; json DTO/entity |
| POST | `/api/announcement-overlays/:id/unpin` | deps.requireEmployee() | Neon via storage/db | params id; schema announcementIdSchema | status 400; json DTO/entity |
| GET | `/api/announcement-overlays/hidden` | deps.requireSupervisor() | Neon via storage/db | - | json DTO/entity |

### server/modules/announcements/index.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/announcements/:id/ack` | requireSession | Neon via storage/db | params id; body; schema acknowledgementSchema | status 400/403/201 |
| GET | `/api/announcements/acknowledgements` | requireSession | Neon via storage/db | query facilityKey | status 403; json {items} |

### server/modules/announcements/widget-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/widgets/announcements/campaigns` | requireSession | computed/static | query facility, limit | json {total} |
| GET | `/api/widgets/announcements/important` | requireSession | external HTTP | query facility, role, limit | json {total} |

### server/modules/anomalies/legacy-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/anomaly-report` | upload.fields([ { name: "images", maxCount: 5 }, { name: "image", maxCount: 5 }, { name: "files", maxCount: 5 }, { name: "file", maxCount: 5 }, { name: "photo", maxCount: 5 }, { name: "photos", maxCount: 5 }, ]) | LINE proxy/LINE authority + Neon via storage/db | body; multipart/file | status 400/200/500 |
| GET | `/api/anomaly-reports` | public/none in route | Neon via storage/db | - | status 500; json DTO/entity |
| DELETE | `/api/anomaly-reports/:id` | public/none in route | Neon via storage/db | params id | status 400/404/500; json {success, deletedId} |
| GET | `/api/anomaly-reports/:id` | public/none in route | Neon via storage/db + external HTTP | params id | status 404/400/500; json {source} |
| PATCH | `/api/anomaly-reports/:id/resolution` | public/none in route | Neon via storage/db | params id; body | status 400/404/500; json DTO/entity |
| PATCH | `/api/anomaly-reports/batch/resolution` | public/none in route | Neon via storage/db | body | status 400/500; json {updated} |
| POST | `/api/test-email` | public/none in route | computed/static | - | status 500/400; json DTO/entity |

### server/modules/auth/legacy-ragic-auth.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/ragic-login` | public/none in route | Ragic/cache + memory/cache | body | status 400/503/401/403/500; json {employeeNumber, name, role, department, status, isSupervisor} |

### server/modules/auth/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/active-facility` | requireSession | computed/static | body | status 401/400/403; json DTO/entity |
| POST | `/api/auth/active-role` | requireSession | computed/static | body | status 401/400/403; json DTO/entity |
| GET | `/api/auth/facility-candidates` | requireSession | Ragic/cache + memory/cache + mock/fallback | - | status 401; json DTO/entity |
| POST | `/api/auth/login` | public/none in route | Ragic/cache + mock/fallback | body | status 401/201 |
| POST | `/api/auth/logout` | public/none in route | computed/static | - | status 204; send/empty |
| GET | `/api/auth/me` | requireSession | computed/static | - | json DTO/entity |

### server/modules/bff/employee-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/employee/announcements` | requireSession | mock/fallback | query facilityKey | json DTO/entity |
| GET | `/api/bff/employee/announcements/:id` | requireSession | mock/fallback | params id; query facilityKey | status 404; json DTO/entity |
| GET | `/api/bff/employee/home` | requireSession | mock/fallback | query facilityKey | json DTO/entity |
| GET | `/api/bff/employee/quick-action-candidates` | requireSession | computed/static | query facilityKey | json {items} |
| GET | `/api/bff/employee/search` | requireSession | mock/fallback | query q, facilityKey | json {items} |
| GET | `/api/bff/employee/shifts/today` | requireSession | mock/fallback | query facilityKey | json DTO/entity |
| GET | `/api/bff/employee/widget-layout` | requireSession | computed/static | - | status 400; json {widgets, isDefault} |
| PUT | `/api/bff/employee/widget-layout` | requireSession | Neon via storage/db | body; schema widgetLayoutUpdateSchema | status 400; json {widgets, isDefault} |
| GET | `/api/bff/employee/workbench-preferences` | requireSession | Neon via storage/db | schema employeeWorkbenchPreferenceSchema | json DTO/entity |
| PUT | `/api/bff/employee/workbench-preferences` | requireSession | Neon via storage/db | body; schema employeeWorkbenchPreferenceSchema | status 400/403; json DTO/entity |
| GET | `/api/bff/lifeguard/home` | requireRole("lifeguard", "system") | memory/cache | - | json DTO/entity |
| GET | `/api/search/global` | requireSession | computed/static | query q | json DTO/entity |

### server/modules/bff/notification-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/workbench/notifications` | requireSession | Neon via storage/db + memory/cache | - | json DTO/entity |
| POST | `/api/bff/workbench/notifications` | requireSession + requireRole("supervisor", "system") | Neon via storage/db | body; schema notificationInputSchema | status 503/400/403/201/500 |
| PATCH | `/api/bff/workbench/notifications/:deliveryId/read` | requireSession | Neon via storage/db | params deliveryId | status 503/400/500; json {ok, deliveryId, readAt} |

### server/modules/bff/routes.ts

No direct Express endpoint definitions in this file.

### server/modules/bff/supervisor-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/supervisor/dashboard` | requireRole("supervisor", "system") | Ragic/cache + LINE proxy/LINE authority + Neon via storage/db + memory/cache + mock/fallback | - | json DTO/entity |
| GET | `/api/bff/supervisor/facilities/:facilityKey/detail` | requireRole("supervisor", "system") | LINE proxy/LINE authority + Neon via storage/db + mock/fallback | params facilityKey | status 400/403; json DTO/entity; file/static |
| GET | `/api/bff/supervisor/facilities/:facilityKey/schedule` | requireRole("supervisor", "system") | LINE proxy/LINE authority + mock/fallback | params facilityKey | status 400/403; json DTO/entity |
| GET | `/api/bff/supervisor/handovers` | requireRole("supervisor", "system") | LINE proxy/LINE authority + Neon via storage/db | query facilityKey, status, q | status 403; json DTO/entity |

### server/modules/bff/system-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/dashboard` | public/none in route | computed/static | - | - |
| GET | `/api/bff/system/overview` | public/none in route | computed/static | - | - |

### server/modules/collab-courses/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/collab-courses/schedules` | requireEmployee() | computed/static | - | status 400/502; json DTO/entity |
| GET | `/api/bff/collab-courses/venues` | requireEmployee() | computed/static | - | status 502; json DTO/entity |

### server/modules/courts/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/courts/:school/admin/import` | auth | Google/Gemini + Neon via storage/db | body; schema courtBatchImportSchema | status 400/500; json {createdCount, skippedCount} |
| GET | `/api/courts/:school/admin/reservations` | auth | Google/Gemini + Neon via storage/db | query startDate, endDate | status 500; json {count, results} |
| DELETE | `/api/courts/:school/admin/reservations/:id` | auth | Google/Gemini + Neon via storage/db | params id | status 404/403/500; json {success} |
| PATCH | `/api/courts/:school/admin/reservations/:id` | auth | Google/Gemini + Neon via storage/db | params id; body; schema patchSchema | status 404/403/400/409/500; json DTO/entity |
| GET | `/api/courts/:school/admin/sync-errors` | auth | Google/Gemini + Neon via storage/db | query limit | status 500; json DTO/entity |
| GET | `/api/courts/:school/admin/sync-logs` | auth | Google/Gemini + Neon via storage/db | query limit | status 500; json DTO/entity |
| GET | `/api/courts/:school/reservations-month/:yearMonth` | auth | Google/Gemini + Neon via storage/db | params yearMonth | status 500; json DTO/entity |
| GET | `/api/courts/:school/reservations/:date` | auth | Google/Gemini + Neon via storage/db | params date | status 500; json DTO/entity |
| GET | `/api/courts/:school/search` | auth | Google/Gemini + Neon via storage/db | query q, startDate, endDate | status 500; json {query, count, results} |
| GET | `/api/courts/:school/stats` | auth | Google/Gemini + Neon via storage/db | - | status 500; json {todayCount, googleCalendarEnabled, status, checkedAt} |

### server/modules/external-proxy/legacy-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/interview-users` | inline bearer token check | LINE proxy/LINE authority | - | status 502; json DTO/entity |
| GET | `/api/admin/overview` | public/none in route | external HTTP | - | - |
| GET | `/api/announcement-candidates` | public/none in route | LINE proxy/LINE authority | - | - |
| GET | `/api/announcement-candidates/:id` | public/none in route | LINE proxy/LINE authority | params id | - |
| PATCH | `/api/announcement-candidates/:id` | public/none in route | LINE proxy/LINE authority + memory/cache | params id; body | - |
| POST | `/api/announcement-candidates/:id/approve` | public/none in route | LINE proxy/LINE authority + memory/cache | params id; body | - |
| POST | `/api/announcement-candidates/:id/publish` | public/none in route | LINE proxy/LINE authority + memory/cache | params id; body | - |
| POST | `/api/announcement-candidates/:id/reject` | public/none in route | LINE proxy/LINE authority + memory/cache | params id; body | - |
| POST | `/api/announcement-candidates/:id/unpublish` | public/none in route | LINE proxy/LINE authority + memory/cache | params id; body | - |
| GET | `/api/announcement-candidates/export/all` | public/none in route | LINE proxy/LINE authority | - | status 502; json DTO/entity |
| GET | `/api/announcement-dashboard/summary` | public/none in route | LINE proxy/LINE authority | - | - |
| GET | `/api/announcement-reports/weekly` | public/none in route | LINE proxy/LINE authority | - | - |
| GET | `/api/facility-home/:groupId/announcements` | public/none in route | LINE proxy/LINE authority | params groupId | - |
| GET | `/api/facility-home/:groupId/announcements/:id` | public/none in route | LINE proxy/LINE authority | params groupId, id | - |
| POST | `/api/facility-home/:groupId/announcements/:id/ack` | public/none in route | LINE proxy/LINE authority | params groupId, id; body | - |
| GET | `/api/facility-home/:groupId/handover` | public/none in route | LINE proxy/LINE authority | params groupId | - |
| GET | `/api/facility-home/:groupId/home` | public/none in route | LINE proxy/LINE authority | params groupId | - |
| GET | `/api/facility-home/:groupId/today-shift` | public/none in route | LINE proxy/LINE authority | params groupId | - |
| GET | `/exports/:filename` | public/none in route | computed/static | params filename | status 404; file/static |

### server/modules/group-broadcasts/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/group-broadcasts` | requireEmployee | Neon via storage/db | query limit, page | status 400/500; json {data} |
| POST | `/api/group-broadcasts` | inline bearer token check | LINE proxy/LINE authority + Google/Gemini + Neon via storage/db | body; schema postSchema | status 401/400/201/500 |
| DELETE | `/api/group-broadcasts/:id` | requireSupervisor | Neon via storage/db | params id | status 400/404/500; json {success} |
| GET | `/api/group-broadcasts/admin` | requireSupervisor | Neon via storage/db | query sourceFacilityKey, limit, page | status 500; json {data} |

### server/modules/handover/index.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/employee/handover/list` | requireSession | computed/static | query facilityKey | status 403; json DTO/entity |
| GET | `/api/bff/employee/handover/summary` | requireSession | computed/static | - | status 403; json DTO/entity |
| POST | `/api/handover` | requireSession | Neon via storage/db | body; schema createHandoverSchema | status 403/400/201 |
| DELETE | `/api/handover/:id` | requireSession | Neon via storage/db | params id | status 400/404/403; json DTO/entity |
| PATCH | `/api/handover/:id/complete` | requireSession | Neon via storage/db | params id | status 400/404/403; json DTO/entity |
| PATCH | `/api/handover/:id/read` | requireSession | Neon via storage/db | params id | status 400/404/403; json DTO/entity |
| PATCH | `/api/handover/:id/reply` | requireSession | Neon via storage/db | params id; body; schema replyHandoverSchema | status 400/404/403; json DTO/entity |
| POST | `/api/handover/image-upload` | requireSession + imageUpload.single("image") | object storage | body; multipart/file | status 403/400/201 |

### server/modules/lane-rentals/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/lane-rentals` | requireEmployee() | Neon via storage/db | query facilityKey, date | status 400/403/500; json DTO/entity |
| POST | `/api/lane-rentals` | requireSupervisor() | Neon via storage/db | body; schema insertLaneRentalSchema | status 400/403/409/500; json DTO/entity |
| DELETE | `/api/lane-rentals/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404/403/500; json DTO/entity |
| PATCH | `/api/lane-rentals/:id` | requireSupervisor() | Neon via storage/db | params id; body; schema updateLaneRentalSchema | status 400/404/403/409/500; json DTO/entity |
| GET | `/api/lane-rentals/layout` | requireEmployee() | Neon via storage/db | query facilityKey | status 400/403/500; json DTO/entity |
| PUT | `/api/lane-rentals/layout` | requireSupervisor() | Neon via storage/db | query facilityKey; body; schema insertLaneRentalLayoutSchema | status 400/403/500; json DTO/entity |

### server/modules/lifeguard/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/employee/lost-and-found` | deps.requireEmployee() | Neon via storage/db | query facilityKey, status, category | json {items} |
| POST | `/api/bff/employee/lost-and-found` | deps.requireEmployee() | computed/static | - | - |
| PATCH | `/api/bff/employee/lost-and-found/:id` | deps.requireEmployee() | Neon via storage/db | params id; body; schema lostItemUpdateSchema | status 400/404; json {item} |
| POST | `/api/bff/employee/lost-and-found/:id/claim` | deps.requireEmployee() | Neon via storage/db | params id; body; schema claimSchema | status 400/404/409; json {item} |
| POST | `/api/bff/employee/lost-and-found/:id/dispose` | deps.requireEmployee() | Neon via storage/db | params id; body; schema disposeSchema | status 400/404/409; json {item} |
| POST | `/api/bff/lifeguard/cleanup` | deps.requireEmployee() | computed/static | - | - |
| POST | `/api/bff/lifeguard/coach-dive` | deps.requireEmployee() | computed/static | - | - |
| POST | `/api/bff/lifeguard/lane-issues` | deps.requireEmployee() | Neon via storage/db | body; schema laneIssueSchema | status 403/400/500; json {item} |
| GET | `/api/bff/lifeguard/lane-rentals` | deps.requireEmployee() | Neon via storage/db | query facilityKey, date | json {facilityKey} |
| GET | `/api/bff/lifeguard/lost-and-found` | deps.requireEmployee() | Neon via storage/db | query facilityKey, status, category | json {items} |
| POST | `/api/bff/lifeguard/lost-and-found` | deps.requireEmployee() | computed/static | - | - |
| PATCH | `/api/bff/lifeguard/lost-and-found/:id` | deps.requireEmployee() | Neon via storage/db | params id; body; schema lostItemUpdateSchema | status 400/404; json {item} |
| POST | `/api/bff/lifeguard/lost-and-found/:id/claim` | deps.requireEmployee() | Neon via storage/db | params id; body; schema claimSchema | status 400/404/409; json {item} |
| POST | `/api/bff/lifeguard/lost-and-found/:id/dispose` | deps.requireEmployee() | Neon via storage/db | params id; body; schema disposeSchema | status 400/404/409; json {item} |
| POST | `/api/bff/lifeguard/photo-upload` | deps.requireEmployee() + upload.single("photo") | computed/static | body; multipart/file; schema photoMetadataSchema | status 400/403/500; json DTO/entity |
| GET | `/api/bff/lifeguard/records` | deps.requireEmployee() | Neon via storage/db | query facilityKey, days | json {facilityKey, waterQuality, coachDive, cleanup, lostItems, laneIssues} |
| POST | `/api/bff/lifeguard/water-quality` | deps.requireEmployee() | computed/static | - | - |

### server/modules/notification-recipients/legacy-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/notification-recipients` | public/none in route | Neon via storage/db | - | status 500; json DTO/entity |
| POST | `/api/notification-recipients` | public/none in route | Neon via storage/db | body | status 400/201/500 |
| DELETE | `/api/notification-recipients/:id` | public/none in route | Neon via storage/db | params id | status 400/404/500; json {success} |
| PATCH | `/api/notification-recipients/:id` | public/none in route | Neon via storage/db | params id; body | status 400/404/500; json DTO/entity |

### server/modules/parking/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/parking/contracts` | requireEmployee() | Neon via storage/db | query status, vehicleId, limit | json DTO/entity |
| POST | `/api/parking/contracts` | requireSupervisor() | Neon via storage/db | body; schema insertParkingContractSchema | status 400/500; json DTO/entity |
| DELETE | `/api/parking/contracts/:id` | requireSupervisor() | Neon via storage/db | params id | status 404; json {ok} |
| GET | `/api/parking/contracts/:id` | requireEmployee() | Neon via storage/db | params id | status 404; json DTO/entity |
| PATCH | `/api/parking/contracts/:id` | requireSupervisor() | Neon via storage/db | params id; body; schema updateContractSchema | status 400/404; json DTO/entity |
| POST | `/api/parking/contracts/:id/issue-sign-link` | requireSupervisor() | Neon via storage/db | params id | status 404/409; json DTO/entity |
| POST | `/api/parking/contracts/:id/refund` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json DTO/entity |
| POST | `/api/parking/contracts/:id/sign` | requireSupervisor() | Neon via storage/db | params id; body | status 404/409 |
| POST | `/api/parking/contracts/:id/terminate` | requireSupervisor() | Neon via storage/db | params id; body | status 404; json DTO/entity |
| GET | `/api/parking/dashboard` | requireEmployee() | Neon via storage/db | - | status 500; json DTO/entity |
| GET | `/api/parking/event-days` | requireEmployee() | Neon via storage/db | query fromDate, toDate | json DTO/entity |
| POST | `/api/parking/event-days` | requireSupervisor() | Neon via storage/db | body; schema insertParkingEventDaySchema | status 400; json DTO/entity |
| DELETE | `/api/parking/event-days/:id` | requireSupervisor() | Neon via storage/db | params id | status 404; json {ok} |
| PATCH | `/api/parking/event-days/:id` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json DTO/entity |
| GET | `/api/parking/payments` | requireEmployee() | Neon via storage/db | query status, contractId | json DTO/entity |
| POST | `/api/parking/payments` | requireSupervisor() | Neon via storage/db | body; schema insertParkingPaymentSchema | status 400/409; json DTO/entity |
| POST | `/api/parking/payments/:id/review` | requireSupervisor() | Neon via storage/db | params id; body; schema reviewPaymentSchema | status 400/404/409; json DTO/entity |
| GET | `/api/parking/plans` | requireEmployee() | Neon via storage/db | query includeInactive | json DTO/entity |
| POST | `/api/parking/plans` | requireSupervisor() | Neon via storage/db | body; schema insertParkingPlanSchema | status 400/409/500; json DTO/entity |
| DELETE | `/api/parking/plans/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404; json {ok} |
| PATCH | `/api/parking/plans/:id` | requireSupervisor() | Neon via storage/db | params id; body; schema updatePlanSchema | status 400/404; json DTO/entity |
| GET | `/api/parking/sign-tokens/:token` | public/none in route | Neon via storage/db | params token | status 400/404/410/409; json DTO/entity |
| POST | `/api/parking/sign-tokens/:token/finalize` | public/none in route | Neon via storage/db | params token; body | status 404/410/409 |
| POST | `/api/parking/sign-tokens/:token/upload-url` | public/none in route | Neon via storage/db + object storage | params token | status 404/410/409; json DTO/entity |
| GET | `/api/parking/vehicles` | requireEmployee() | Neon via storage/db | query search, vehicleType, status, expiringWithinDays, limit, offset | json DTO/entity |
| POST | `/api/parking/vehicles` | requireSupervisor() | Neon via storage/db | body; schema insertParkingVehicleSchema | status 400/409/500; json DTO/entity |
| DELETE | `/api/parking/vehicles/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404; json {ok} |
| GET | `/api/parking/vehicles/:id` | requireEmployee() | Neon via storage/db | params id | status 400/404; json DTO/entity |
| PATCH | `/api/parking/vehicles/:id` | requireSupervisor() | Neon via storage/db | params id; body; schema updateVehicleSchema | status 400/404; json DTO/entity |

### server/modules/portal/content-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/supervisor/qna-review` | requireSupervisor() | Neon via storage/db | query facilityKey, limit | status 403/503/500; json DTO/entity |
| POST | `/api/bff/supervisor/qna-review/:id/approve` | requireSupervisor() | computed/static | - | - |
| POST | `/api/bff/supervisor/qna-review/:id/reject` | requireSupervisor() | computed/static | - | - |
| GET | `/api/portal/analytics` | public/none in route | Neon via storage/db | query sinceDays, facilityKey | status 500; json DTO/entity |
| GET | `/api/portal/employee-resources` | requireEmployee() | Neon via storage/db | query facilityKey, category, limit | status 400/403/503/500; json DTO/entity |
| POST | `/api/portal/employee-resources` | requireEmployee() | Neon via storage/db | body; schema insertEmployeeResourceSchema | status 400/403/201/503/500 |
| DELETE | `/api/portal/employee-resources/:id` | requireEmployee() | Neon via storage/db | params id | status 400/404/403/503/500; json DTO/entity |
| PATCH | `/api/portal/employee-resources/:id` | requireEmployee() | Neon via storage/db | params id; body; schema patchSchema | status 400/404/403/503/500; json DTO/entity |
| POST | `/api/portal/events` | public/none in route | Neon via storage/db | body; schema insertPortalEventSchema | status 400/204/500 |
| GET | `/api/portal/knowledge-base-qna` | requireEmployee() | Neon via storage/db | query facilityKey, q, limit | status 400/403/503/500; json DTO/entity |
| POST | `/api/portal/knowledge-base-qna` | requireEmployee() | Neon via storage/db | body; schema insertKnowledgeBaseQnaSchema | status 400/403/201/503/500; file/static |
| DELETE | `/api/portal/knowledge-base-qna/:id` | requireEmployee() | Neon via storage/db | params id | status 400/404/403/503/500; json DTO/entity |
| PATCH | `/api/portal/knowledge-base-qna/:id` | requireEmployee() | Neon via storage/db | params id; body; schema patchSchema | status 400/404/403/503/500; json DTO/entity; file/static |
| POST | `/api/portal/knowledge-base-qna/media` | requireEmployee() | computed/static | body; multipart/file | status 400/403/201 |
| GET | `/api/portal/layout-settings` | requireEmployee() | Neon via storage/db | query facilityKey, role, layoutKey | status 400/403/500; json {widgets, updatedAt} |
| PATCH | `/api/portal/layout-settings` | requireSupervisor() | Neon via storage/db | body; schema bodySchema | status 400/403/500; json DTO/entity |
| GET | `/api/portal/quick-links` | public/none in route | Neon via storage/db | query facilityKey, includeInactive | status 500; json {items} |
| POST | `/api/portal/quick-links` | requireSupervisor() | Neon via storage/db | body; schema insertQuickLinkSchema | status 400/201/500 |
| DELETE | `/api/portal/quick-links/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404/500; json {ok} |
| PATCH | `/api/portal/quick-links/:id` | requireSupervisor() | Neon via storage/db | params id; body; schema quickLinkPatchSchema | status 400/404/500; json DTO/entity |
| GET | `/api/portal/system-announcements` | public/none in route | Neon via storage/db | query facilityKey, includeInactive | json DTO/entity |
| POST | `/api/portal/system-announcements` | requireSupervisor() | Neon via storage/db | body; schema insertSystemAnnouncementSchema | status 400/201/500 |
| DELETE | `/api/portal/system-announcements/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404/500; json {ok} |
| PATCH | `/api/portal/system-announcements/:id` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404/500; json DTO/entity |

### server/modules/portal/handover-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/portal/handovers` | public/none in route | Neon via storage/db | query facilityKey, limit | status 400/500; json DTO/entity |
| POST | `/api/portal/handovers` | requireEmployee() | Neon via storage/db | body; schema insertHandoverEntrySchema | status 400/201/500 |
| DELETE | `/api/portal/handovers/:id` | requireEmployee() | Neon via storage/db | params id | status 400/404/403/500; json {ok} |
| GET | `/api/portal/operational-handovers` | requireEmployee() | Neon via storage/db | query facilityKey, status, targetDate, limit | status 400/403; json {items} |
| POST | `/api/portal/operational-handovers` | requireSupervisor() | Neon via storage/db | body; schema operationalHandoverCreateBodySchema | status 400/403/201/500 |
| DELETE | `/api/portal/operational-handovers/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404/403/500; json DTO/entity |
| PATCH | `/api/portal/operational-handovers/:id` | requireSupervisor() | Neon via storage/db | params id; body; schema operationalHandoverPatchBodySchema | status 400/404/403/500; json DTO/entity |
| PATCH | `/api/portal/operational-handovers/:id/report` | requireEmployee() | Neon via storage/db | params id; body; schema operationalHandoverReportBodySchema | status 400/404/403/500; json DTO/entity |

### server/modules/register.ts

No direct Express endpoint definitions in this file.

### server/modules/registry/moduleRegistryController.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| PATCH | `/api/modules/:moduleId/settings` | requireSession | computed/static | params moduleId | status 403/202 |
| GET | `/api/modules/health` | requireSession | memory/cache | - | json {role, items, undefined} |
| GET | `/api/modules/home-layout` | requireSession | memory/cache | - | json {role, cards} |
| GET | `/api/modules/navigation` | requireSession | memory/cache | - | json {role, items} |
| GET | `/api/modules/registry` | requireSession | computed/static | - | json {items, visibility} |
| GET | `/api/system/module-registry` | requireSession + requireRole("system") | computed/static | - | json {items, visibility} |
| GET | `/api/system/module-registry-role/:role` | requireSession + requireRole("system") | computed/static | params role | status 400; json DTO/entity |
| GET | `/api/system/module-registry/:id` | requireSession + requireRole("system") | computed/static | params id | status 404; json DTO/entity |

### server/modules/system/action-monitoring-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/action-monitoring` | requireSession + requireRole("system") | computed/static | - | status 500; json DTO/entity |

### server/modules/system/api-monitoring-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/api-monitoring` | requireSession + requireRole("system") | computed/static | query projectKey | json DTO/entity |
| GET | `/api/bff/system/api-monitoring/:rowId/detail` | requireSession + requireRole("system") | computed/static | params rowId; query projectKey, route, label, method, status, checkedAt, durationMs, statusCode | status 404; json DTO/entity |
| PATCH | `/api/bff/system/api-monitoring/error-groups/:fingerprint/status` | requireSession + requireRole("system") | Neon via storage/db | params fingerprint; body | status 400/404; json DTO/entity |
| GET | `/api/db-health` | public/none in route | Neon via storage/db | - | - |
| GET | `/api/health` | public/none in route | computed/static | - | json {status, checkedAt, service} |
| GET | `/api/line-health` | public/none in route | LINE proxy/LINE authority | - | - |
| GET | `/api/ragic-health` | public/none in route | Ragic/cache + memory/cache | - | - |

### server/modules/system/caution-permissions-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/cms/system/caution-permissions` | requireSession + requireRole("system") | computed/static | query status, dept, q | json DTO/entity |
| POST | `/api/cms/system/caution-permissions` | requireSession + requireRole("system") | Neon via storage/db + memory/cache | body; schema cautionCreateSchema | status 400/503 |
| GET | `/api/cms/system/caution-permissions/:id/audit` | requireSession + requireRole("system") | computed/static | params id | status 400/503; json DTO/entity |
| POST | `/api/cms/system/caution-permissions/:id/log-usage` | public/none in route | Neon via storage/db | params id; body; schema cautionUsageSchema | status 400/404/201/503 |
| PATCH | `/api/cms/system/caution-permissions/:id/period` | requireSession + requireRole("system") | Neon via storage/db + memory/cache | params id; body; schema cautionPeriodPatchSchema | status 400/404/503; json DTO/entity |
| PATCH | `/api/cms/system/caution-permissions/:id/status` | requireSession + requireRole("system") | Neon via storage/db + memory/cache | params id; body; schema cautionStatusPatchSchema | status 400/404/503; json DTO/entity |
| GET | `/api/cms/system/caution-permissions/candidates` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority + Neon via storage/db + memory/cache + mock/fallback | query q | json {sourceStatus} |
| GET | `/api/cms/system/caution-permissions/check` | public/none in route | Neon via storage/db | query userId | status 400/503; json DTO/entity |

### server/modules/system/helper-status-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/helper-status` | requireSession + requireRole("system") | computed/static | - | json DTO/entity |

### server/modules/system/line-bot-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/line-bot/interview-users` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| POST | `/api/bff/system/line-bot/interview-users` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| DELETE | `/api/bff/system/line-bot/interview-users/:userId` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| PATCH | `/api/bff/system/line-bot/interview-users/:userId` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| GET | `/api/bff/system/line-bot/service-status` | requireSession + requireRole("system") | LINE proxy/LINE authority + mock/fallback | - | status 503/502; json DTO/entity |
| GET | `/api/bff/system/line-bot/service-status/snapshots` | requireSession + requireRole("system") + inline bearer token check | LINE proxy/LINE authority + memory/cache | - | status 503/502; json DTO/entity |
| GET | `/api/bff/system/line-bot/vip-whitelist` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| POST | `/api/bff/system/line-bot/vip-whitelist` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| DELETE | `/api/bff/system/line-bot/vip-whitelist/:id` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| PATCH | `/api/bff/system/line-bot/vip-whitelist/:id` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | - |
| GET | `/api/internal/service-health` | inline bearer token check | LINE proxy/LINE authority | - | status 503/502; json DTO/entity |
| GET | `/api/internal/service-health/snapshots` | inline bearer token check | LINE proxy/LINE authority + memory/cache | query hours | status 503/502; json DTO/entity |

### server/modules/system/line-whitelist-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/line-whitelist` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | json DTO/entity |
| POST | `/api/bff/system/line-whitelist` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority + Neon via storage/db | body; schema lineWhitelistUpsertSchema | status 400/503 |
| DELETE | `/api/bff/system/line-whitelist/:id` | requireSession + requireRole("system") | LINE proxy/LINE authority | - | status 405 |
| PATCH | `/api/bff/system/line-whitelist/:id` | requireSession + requireRole("system") | LINE proxy/LINE authority + Neon via storage/db | params id; body; schema lineWhitelistPatchSchema | status 400/404/503; json DTO/entity |
| GET | `/api/bff/system/line-whitelist/candidates` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority | query q | status 503; json DTO/entity |
| POST | `/api/bff/system/line-whitelist/import-interview-users` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority | - | status 410 |
| GET | `/api/internal/interview-users` | public/none in route | LINE proxy/LINE authority + Neon via storage/db | - | status 503; json {total} |
| GET | `/api/internal/line-whitelist/check` | public/none in route | LINE proxy/LINE authority | query lineUserId, feature | status 400/503; json {allowed, entry} |
| GET | `/api/system/whitelist/ragic-search` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority | query q | status 503; json DTO/entity |

### server/modules/system/linebot-management-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/linebot-management/announcement-pipeline` | requireSession + requireRole("system") | LINE proxy/LINE authority + Google/Gemini + memory/cache + mock/fallback | - | json DTO/entity |
| GET | `/api/bff/system/linebot-management/facilities` | requireSession + requireRole("system") | LINE proxy/LINE authority + memory/cache + mock/fallback | - | json DTO/entity |
| GET | `/api/bff/system/linebot-management/overview` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback | - | json DTO/entity |
| GET | `/api/bff/system/linebot-management/services` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback | - | json DTO/entity |
| GET | `/api/bff/system/linebot-management/whitelist-comparison` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback | - | json {knownIssues} |
| GET | `/api/bff/system/linebot-management/whitelist-snapshot` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback | - | json {knownIssues} |
| POST | `/api/bff/system/linebot-management/whitelist-sync-shadow` | requireSession + requireRole("system") | LINE proxy/LINE authority | body | json DTO/entity |
| GET | `/api/bff/system/lineXBS-status` | requireSession + requireRole("system") | LINE proxy/LINE authority + memory/cache + mock/fallback | - | json DTO/entity |

### server/modules/system/module-health-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/module-health/:moduleId` | requireSession + requireRole("system") | computed/static | params moduleId | status 404/500; json {checkedAt} |

### server/modules/system/operations-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/operations/recent-assists` | requireSession + requireRole("system") | Neon via storage/db | query limit | json DTO/entity |
| GET | `/api/bff/system/operations/user-search` | requireSession + requireRole("system") | computed/static | query q | json DTO/entity |
| GET | `/api/bff/system/operations/user/:userId` | requireSession + requireRole("system") | Neon via storage/db | params userId | status 404; json DTO/entity |
| POST | `/api/bff/system/operations/user/:userId/refresh-cache` | requireSession + requireRole("system") | memory/cache | params userId; body; schema refreshCacheSchema | status 400/404/403; json {ok} |
| POST | `/api/bff/system/operations/user/:userId/resend-notification` | requireSession + requireRole("system") | computed/static | params userId; body; schema resendNotificationSchema | status 400/404/403; json {ok, notificationStatus, errorMessage} |
| POST | `/api/bff/system/operations/user/:userId/reset-session` | requireSession + requireRole("system") | Neon via storage/db | params userId; body; schema opsReasonSchema | status 400/404/403/500; json {ok, sessionsCleared} |

### server/modules/system/project-monitoring-routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/project-monitoring` | requireSession + requireRole("system") | Neon via storage/db | - | json DTO/entity |
| GET | `/api/bff/system/project-monitoring/:projectKey` | requireSession + requireRole("system") | computed/static | params projectKey | status 404; json DTO/entity |

### server/modules/system/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/bff/system/control-center` | requireSession + requireRole("system") | Neon via storage/db + memory/cache | - | json DTO/entity |
| GET | `/api/bff/system/api-catalog` | requireSession + requireRole("system") | apiRouteManifest + MODULE_REGISTRY + module data/integration bindings | - | json API catalog with project/feature/role/module/data-source classifications |
| GET | `/api/bff/system/health-overview` | requireSession + requireRole("system") | Ragic/cache + Neon via storage/db + memory/cache + mock/fallback | - | json DTO/entity |
| GET | `/api/bff/system/insights/module/:moduleId` | requireSession + requireRole("system") | computed/static | params moduleId; query period | status 404; json DTO/entity |
| GET | `/api/bff/system/insights/overview` | requireSession + requireRole("system") | computed/static | query period | json DTO/entity |
| GET | `/api/bff/system/integration-overview` | requireSession + requireRole("system") | Ragic/cache + LINE proxy/LINE authority + mock/fallback | - | json DTO/entity |
| GET | `/api/bff/system/schedule-snapshot` | requireSession + requireRole("system") | memory/cache + mock/fallback | query facilityKey, from, to | status 502; json DTO/entity |
| GET | `/api/bff/system/watchdog-events` | requireSession + requireRole("system") | Neon via storage/db | - | json {items} |
| GET | `/api/internal/announcement-whitelist` | public/none in route | LINE proxy/LINE authority + Neon via storage/db | - | json {items, total} |
| POST | `/api/internal/announcement-whitelist` | public/none in route | LINE proxy/LINE authority + Neon via storage/db | body; schema awSchema | status 400/409/201 |
| DELETE | `/api/internal/announcement-whitelist/:userId` | public/none in route | LINE proxy/LINE authority + Neon via storage/db | params userId | status 400/404; json {ok, deleted} |
| PATCH | `/api/internal/announcement-whitelist/:userId` | public/none in route | LINE proxy/LINE authority + Neon via storage/db | params userId; body | status 400/404; json DTO/entity |
| POST | `/api/watchdog/events` | public/none in route | Neon via storage/db | body; schema watchdogEventSchema | status 503/401/403/400/201 |

### server/modules/telemetry/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/audit/logs` | requireSession + requireRole("system") | Neon via storage/db | query limit | json {items, limit} |
| GET | `/api/bff/system/ui-event-overview` | requireSession + requireRole("system") | Neon via storage/db | - | json DTO/entity |
| POST | `/api/telemetry/client-error` | inline session/facility check | Neon via storage/db | body | status 202 |
| GET | `/api/telemetry/module-events` | requireSession + requireRole("system") | Neon via storage/db | - | json DTO/entity |
| GET | `/api/telemetry/training-views` | requireSession + requireRole("system") | Neon via storage/db | - | json DTO/entity |
| POST | `/api/telemetry/ui-events` | inline session/facility check | Neon via storage/db | body | status 429/202 |

### server/modules/work-logs/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/storage/objects/*splat` | requireEmployee() | memory/cache + object storage | - | status 400/403/404; send/empty; file/static |
| GET | `/api/work-logs/admin/assigned-tasks` | requireSupervisor() | Neon via storage/db | query facilityKey, moduleType, status, taskDate | status 400; json DTO/entity |
| POST | `/api/work-logs/admin/assigned-tasks` | requireSupervisor() | Neon via storage/db | body; schema insertLifeguardAssignedTaskSchema | status 400; json DTO/entity |
| DELETE | `/api/work-logs/admin/assigned-tasks/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404; json {ok} |
| PATCH | `/api/work-logs/admin/assigned-tasks/:id` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json {item} |
| GET | `/api/work-logs/admin/daily-templates` | requireSupervisor() | Neon via storage/db | query facilityKey, moduleType | status 400; json DTO/entity |
| POST | `/api/work-logs/admin/daily-templates` | requireSupervisor() | Neon via storage/db | body; schema insertDailyTaskTemplateSchema | status 400; json {item} |
| DELETE | `/api/work-logs/admin/daily-templates/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404; json {ok} |
| PATCH | `/api/work-logs/admin/daily-templates/:id` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json {item} |
| POST | `/api/work-logs/admin/daily-templates/bulk` | requireSupervisor() | Neon via storage/db | body; schema insertDailyTaskTemplateSchema | status 400; json {failureCount} |
| GET | `/api/work-logs/admin/recurring-templates` | requireSupervisor() | Neon via storage/db | query facilityKey, moduleType | status 400; json DTO/entity |
| POST | `/api/work-logs/admin/recurring-templates` | requireSupervisor() | Neon via storage/db | body; schema insertRecurringTaskTemplateSchema | status 400; json {item} |
| DELETE | `/api/work-logs/admin/recurring-templates/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404; json {ok} |
| PATCH | `/api/work-logs/admin/recurring-templates/:id` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json {item} |
| POST | `/api/work-logs/admin/recurring-templates/bulk` | requireSupervisor() | Neon via storage/db | body; schema insertRecurringTaskTemplateSchema | status 400; json {failureCount} |
| GET | `/api/work-logs/admin/submissions` | requireSupervisor() | Neon via storage/db | query facilityKey, moduleType, workDate, status | json DTO/entity |
| GET | `/api/work-logs/admin/submissions/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404/500; json DTO/entity |
| POST | `/api/work-logs/admin/submissions/:id/approve` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json {item} |
| POST | `/api/work-logs/admin/submissions/:id/return` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json {item} |
| GET | `/api/work-logs/admin/submissions/export` | requireSupervisor() | Neon via storage/db | query facilityKey, moduleType, fromDate, toDate, workDate, status, format | status 400/500; send/empty; file/static |
| GET | `/api/work-logs/admin/water-schedules` | requireSupervisor() | Neon via storage/db | query facilityKey | status 400; json DTO/entity |
| POST | `/api/work-logs/admin/water-schedules` | requireSupervisor() | Neon via storage/db | body; schema insertWaterQualityScheduleSchema | status 400; json {item} |
| DELETE | `/api/work-logs/admin/water-schedules/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404; json {ok} |
| PATCH | `/api/work-logs/admin/water-schedules/:id` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json {item} |
| GET | `/api/work-logs/admin/water-standards` | requireSupervisor() | Neon via storage/db | query facilityKey | status 400; json DTO/entity |
| POST | `/api/work-logs/admin/water-standards` | requireSupervisor() | Neon via storage/db | body; schema insertWaterQualityStandardSchema | status 400; json {item} |
| DELETE | `/api/work-logs/admin/water-standards/:id` | requireSupervisor() | Neon via storage/db | params id | status 400/404; json {ok} |
| PATCH | `/api/work-logs/admin/water-standards/:id` | requireSupervisor() | Neon via storage/db | params id; body | status 400/404; json {item} |
| POST | `/api/work-logs/handover` | requireEmployee() | Neon via storage/db | body; schema insertLifeguardHandoverNoteSchema | status 400/403/500; json {item} |
| POST | `/api/work-logs/handover/:id/confirm` | requireEmployee() | Neon via storage/db | params id; schema handoverConfirmIdSchema | status 400/404/403/500; json {item} |
| GET | `/api/work-logs/submissions/:id/review-actions` | requireEmployee() | Neon via storage/db | params id | status 400/404/403/500; json DTO/entity |
| POST | `/api/work-logs/submit` | requireEmployee() | Neon via storage/db | body; schema submitSchema | status 400/403/500; json {item} |
| POST | `/api/work-logs/tasks/complete` | requireEmployee() | Neon via storage/db | body; schema completeTaskSchema | status 400/403/500; json {item} |
| GET | `/api/work-logs/today` | requireEmployee() | Neon via storage/db | query facilityKey, shiftType, workDate, moduleType; schema todayQuerySchema | status 400/403/500; json DTO/entity |
| POST | `/api/work-logs/upload` | requireEmployee() | object storage | body; schema uploadFolderSchema | status 400/403; json DTO/entity; file/static |
| POST | `/api/work-logs/water-quality` | requireEmployee() | LINE proxy/LINE authority + Neon via storage/db | body; schema insertWaterQualityRecordSchema | status 400/403/500; json {item} |
| GET | `/api/work-logs/water-standards` | requireEmployee() | Neon via storage/db | query facilityKey, poolName | status 400/403/500; json DTO/entity |

### server/replit_integrations/object_storage/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/^\/objects\/(.+)$/` | public/none in route | object storage | - | status 404/500; file/static |
| POST | `/api/uploads/request-url` | public/none in route | object storage | body | status 400/500; json DTO/entity |

### server/routes.ts

| Method | Path | Auth middleware | Data source | Request summary | Response summary |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/hr-audit` | public/none in route | Ragic/cache | - | status 503 |

## Gate 0 Status

- `api-inventory.md` has been produced and covers the scanned route files plus endpoint-bearing non-pattern files discovered by `rg`.
- Duplicate group recommendations are planning notes only. No forwarding, retirement, middleware, handler, or registration behavior has been changed.
- Stop here for human confirmation before Phase 1.
