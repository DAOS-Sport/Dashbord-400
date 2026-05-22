export type ApiRouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRouteManifestEntry {
  method: ApiRouteMethod;
  path: string;
  handlerFile: string;
  auth: string;
  dataSource: string;
  request: string;
  response: string;
}

export const apiRouteManifest: ApiRouteManifestEntry[] = [
  {
    "method": "GET",
    "path": "/api/admin/announcement-groups",
    "handlerFile": "server/modules/announcement-groups/routes.ts",
    "auth": "deps.requireSupervisor()",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "query facilityKey, isActive",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/admin/announcement-groups",
    "handlerFile": "server/modules/announcement-groups/routes.ts",
    "auth": "deps.requireSupervisor()",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "body; schema insertFacilityAnnouncementGroupSchema",
    "response": "status 400/201/409/500"
  },
  {
    "method": "DELETE",
    "path": "/api/admin/announcement-groups/:id",
    "handlerFile": "server/modules/announcement-groups/routes.ts",
    "auth": "deps.requireSupervisor()",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "params id; schema idParamSchema",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/admin/announcement-groups/:id",
    "handlerFile": "server/modules/announcement-groups/routes.ts",
    "auth": "deps.requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema idParamSchema",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/admin/announcement-groups/:id/test-fetch",
    "handlerFile": "server/modules/announcement-groups/routes.ts",
    "auth": "deps.requireSupervisor()",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db + memory/cache",
    "request": "params id; schema idParamSchema",
    "response": "status 400/404/502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/integrations/announcement-groups/messages",
    "handlerFile": "server/modules/announcement-groups/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "LINE proxy/LINE authority",
    "request": "schema groupQuerySchema",
    "response": "status 400/403/502; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/announcement-overlays/:id/hide",
    "handlerFile": "server/modules/announcement-overlays/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; schema announcementIdSchema",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/announcement-overlays/:id/note",
    "handlerFile": "server/modules/announcement-overlays/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema announcementIdSchema, noteBodySchema",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/announcement-overlays/:id/pin",
    "handlerFile": "server/modules/announcement-overlays/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema announcementIdSchema, pinBodySchema",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/announcement-overlays/:id/unhide",
    "handlerFile": "server/modules/announcement-overlays/routes.ts",
    "auth": "deps.requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; schema announcementIdSchema",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/announcement-overlays/:id/unpin",
    "handlerFile": "server/modules/announcement-overlays/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; schema announcementIdSchema",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/announcement-overlays/hidden",
    "handlerFile": "server/modules/announcement-overlays/routes.ts",
    "auth": "deps.requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/announcements/:id/ack",
    "handlerFile": "server/modules/announcements/index.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema acknowledgementSchema",
    "response": "status 400/403/201"
  },
  {
    "method": "GET",
    "path": "/api/announcements/acknowledgements",
    "handlerFile": "server/modules/announcements/index.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey",
    "response": "status 403; json {items}"
  },
  {
    "method": "GET",
    "path": "/api/widgets/announcements/campaigns",
    "handlerFile": "server/modules/announcements/widget-routes.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "query facility, limit",
    "response": "json {total}"
  },
  {
    "method": "GET",
    "path": "/api/widgets/announcements/important",
    "handlerFile": "server/modules/announcements/widget-routes.ts",
    "auth": "requireSession",
    "dataSource": "external HTTP",
    "request": "query facility, role, limit",
    "response": "json {total}"
  },
  {
    "method": "POST",
    "path": "/api/anomaly-report",
    "handlerFile": "server/modules/anomalies/legacy-routes.ts",
    "auth": "upload.fields([ { name: \"images\", maxCount: 5 }, { name: \"image\", maxCount: 5 }, { name: \"files\", maxCount: 5 }, { name: \"file\", maxCount: 5 }, { name: \"photo\", maxCount: 5 }, { name: \"photos\", maxCount: 5 }, ])",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "body; multipart/file",
    "response": "status 400/200/500"
  },
  {
    "method": "GET",
    "path": "/api/anomaly-reports",
    "handlerFile": "server/modules/anomalies/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "DELETE",
    "path": "/api/anomaly-reports/:id",
    "handlerFile": "server/modules/anomalies/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/500; json {success, deletedId}"
  },
  {
    "method": "GET",
    "path": "/api/anomaly-reports/:id",
    "handlerFile": "server/modules/anomalies/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db + external HTTP",
    "request": "params id",
    "response": "status 404/400/500; json {source}"
  },
  {
    "method": "PATCH",
    "path": "/api/anomaly-reports/:id/resolution",
    "handlerFile": "server/modules/anomalies/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404/500; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/anomaly-reports/batch/resolution",
    "handlerFile": "server/modules/anomalies/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "body",
    "response": "status 400/500; json {updated}"
  },
  {
    "method": "POST",
    "path": "/api/test-email",
    "handlerFile": "server/modules/anomalies/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "computed/static",
    "request": "-",
    "response": "status 500/400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/auth/ragic-login",
    "handlerFile": "server/modules/auth/legacy-ragic-auth.ts",
    "auth": "public/none in route",
    "dataSource": "Ragic/cache + memory/cache",
    "request": "body",
    "response": "status 400/503/401/403/500; json {employeeNumber, name, role, department, status, isSupervisor}"
  },
  {
    "method": "POST",
    "path": "/api/auth/active-facility",
    "handlerFile": "server/modules/auth/routes.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "body",
    "response": "status 401/400/403; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/auth/active-role",
    "handlerFile": "server/modules/auth/routes.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "body",
    "response": "status 401/400/403; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/auth/facility-candidates",
    "handlerFile": "server/modules/auth/routes.ts",
    "auth": "requireSession",
    "dataSource": "Ragic/cache + memory/cache + mock/fallback",
    "request": "-",
    "response": "status 401; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/auth/login",
    "handlerFile": "server/modules/auth/routes.ts",
    "auth": "public/none in route",
    "dataSource": "Ragic/cache + mock/fallback",
    "request": "body",
    "response": "status 401/201"
  },
  {
    "method": "POST",
    "path": "/api/auth/logout",
    "handlerFile": "server/modules/auth/routes.ts",
    "auth": "public/none in route",
    "dataSource": "computed/static",
    "request": "-",
    "response": "status 204; send/empty"
  },
  {
    "method": "GET",
    "path": "/api/auth/me",
    "handlerFile": "server/modules/auth/routes.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/announcements",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "mock/fallback",
    "request": "query facilityKey",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/announcements/:id",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "mock/fallback",
    "request": "params id; query facilityKey",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/home",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "mock/fallback",
    "request": "query facilityKey",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/quick-action-candidates",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "query facilityKey",
    "response": "json {items}"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/search",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "mock/fallback",
    "request": "query q, facilityKey",
    "response": "json {items}"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/shifts/today",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "mock/fallback",
    "request": "query facilityKey",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/widget-layout",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "-",
    "response": "status 400; json {widgets, isDefault}"
  },
  {
    "method": "PUT",
    "path": "/api/bff/employee/widget-layout",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "body; schema widgetLayoutUpdateSchema",
    "response": "status 400; json {widgets, isDefault}"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/workbench-preferences",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "schema employeeWorkbenchPreferenceSchema",
    "response": "json DTO/entity"
  },
  {
    "method": "PUT",
    "path": "/api/bff/employee/workbench-preferences",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "body; schema employeeWorkbenchPreferenceSchema",
    "response": "status 400/403; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/lifeguard/home",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireRole(\"lifeguard\", \"system\")",
    "dataSource": "memory/cache",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/search/global",
    "handlerFile": "server/modules/bff/employee-routes.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "query q",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/workbench/notifications",
    "handlerFile": "server/modules/bff/notification-routes.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db + memory/cache",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/bff/workbench/notifications",
    "handlerFile": "server/modules/bff/notification-routes.ts",
    "auth": "requireSession + requireRole(\"supervisor\", \"system\")",
    "dataSource": "Neon via storage/db",
    "request": "body; schema notificationInputSchema",
    "response": "status 503/400/403/201/500"
  },
  {
    "method": "PATCH",
    "path": "/api/bff/workbench/notifications/:deliveryId/read",
    "handlerFile": "server/modules/bff/notification-routes.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "params deliveryId",
    "response": "status 503/400/500; json {ok, deliveryId, readAt}"
  },
  {
    "method": "GET",
    "path": "/api/bff/supervisor/dashboard",
    "handlerFile": "server/modules/bff/supervisor-routes.ts",
    "auth": "requireRole(\"supervisor\", \"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + Neon via storage/db + memory/cache + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/supervisor/facilities/:facilityKey/detail",
    "handlerFile": "server/modules/bff/supervisor-routes.ts",
    "auth": "requireRole(\"supervisor\", \"system\")",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db + mock/fallback",
    "request": "params facilityKey",
    "response": "status 400/403; json DTO/entity; file/static"
  },
  {
    "method": "GET",
    "path": "/api/bff/supervisor/facilities/:facilityKey/schedule",
    "handlerFile": "server/modules/bff/supervisor-routes.ts",
    "auth": "requireRole(\"supervisor\", \"system\")",
    "dataSource": "LINE proxy/LINE authority + mock/fallback",
    "request": "params facilityKey",
    "response": "status 400/403; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/supervisor/handovers",
    "handlerFile": "server/modules/bff/supervisor-routes.ts",
    "auth": "requireRole(\"supervisor\", \"system\")",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "query facilityKey, status, q",
    "response": "status 403; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/dashboard",
    "handlerFile": "server/modules/bff/system-routes.ts",
    "auth": "public/none in route",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/overview",
    "handlerFile": "server/modules/bff/system-routes.ts",
    "auth": "public/none in route",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/bff/collab-courses/schedules",
    "handlerFile": "server/modules/collab-courses/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "status 400/502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/collab-courses/venues",
    "handlerFile": "server/modules/collab-courses/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "status 502; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/courts/:school/admin/import",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "body; schema courtBatchImportSchema",
    "response": "status 400/500; json {createdCount, skippedCount}"
  },
  {
    "method": "GET",
    "path": "/api/courts/:school/admin/reservations",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "query startDate, endDate",
    "response": "status 500; json {count, results}"
  },
  {
    "method": "DELETE",
    "path": "/api/courts/:school/admin/reservations/:id",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "params id",
    "response": "status 404/403/500; json {success}"
  },
  {
    "method": "PATCH",
    "path": "/api/courts/:school/admin/reservations/:id",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "params id; body; schema patchSchema",
    "response": "status 404/403/400/409/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/courts/:school/admin/sync-errors",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "query limit",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/courts/:school/admin/sync-logs",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "query limit",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/courts/:school/reservations-month/:yearMonth",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "params yearMonth",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/courts/:school/reservations/:date",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "params date",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/courts/:school/search",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "query q, startDate, endDate",
    "response": "status 500; json {query, count, results}"
  },
  {
    "method": "GET",
    "path": "/api/courts/:school/stats",
    "handlerFile": "server/modules/courts/routes.ts",
    "auth": "auth",
    "dataSource": "Google/Gemini + Neon via storage/db",
    "request": "-",
    "response": "status 500; json {todayCount, googleCalendarEnabled, status, checkedAt}"
  },
  {
    "method": "GET",
    "path": "/api/admin/interview-users",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "inline bearer token check",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "status 502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/admin/overview",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "external HTTP",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/announcement-candidates",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/announcement-candidates/:id",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "params id",
    "response": "-"
  },
  {
    "method": "PATCH",
    "path": "/api/announcement-candidates/:id",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + memory/cache",
    "request": "params id; body",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/announcement-candidates/:id/approve",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + memory/cache",
    "request": "params id; body",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/announcement-candidates/:id/publish",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + memory/cache",
    "request": "params id; body",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/announcement-candidates/:id/reject",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + memory/cache",
    "request": "params id; body",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/announcement-candidates/:id/unpublish",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + memory/cache",
    "request": "params id; body",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/announcement-candidates/export/all",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "status 502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/announcement-dashboard/summary",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/announcement-reports/weekly",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/facility-home/:groupId/announcements",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "params groupId",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/facility-home/:groupId/announcements/:id",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "params groupId, id",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/facility-home/:groupId/announcements/:id/ack",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "params groupId, id; body",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/facility-home/:groupId/handover",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "params groupId",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/facility-home/:groupId/home",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "params groupId",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/facility-home/:groupId/today-shift",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "params groupId",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/exports/:filename",
    "handlerFile": "server/modules/external-proxy/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "computed/static",
    "request": "params filename",
    "response": "status 404; file/static"
  },
  {
    "method": "GET",
    "path": "/api/group-broadcasts",
    "handlerFile": "server/modules/group-broadcasts/routes.ts",
    "auth": "requireEmployee",
    "dataSource": "Neon via storage/db",
    "request": "query limit, page",
    "response": "status 400/500; json {data}"
  },
  {
    "method": "POST",
    "path": "/api/group-broadcasts",
    "handlerFile": "server/modules/group-broadcasts/routes.ts",
    "auth": "inline bearer token check",
    "dataSource": "LINE proxy/LINE authority + Google/Gemini + Neon via storage/db",
    "request": "body; schema postSchema",
    "response": "status 401/400/201/500"
  },
  {
    "method": "DELETE",
    "path": "/api/group-broadcasts/:id",
    "handlerFile": "server/modules/group-broadcasts/routes.ts",
    "auth": "requireSupervisor",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/500; json {success}"
  },
  {
    "method": "GET",
    "path": "/api/group-broadcasts/admin",
    "handlerFile": "server/modules/group-broadcasts/routes.ts",
    "auth": "requireSupervisor",
    "dataSource": "Neon via storage/db",
    "request": "query sourceFacilityKey, limit, page",
    "response": "status 500; json {data}"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/handover/list",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "query facilityKey",
    "response": "status 403; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/handover/summary",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "-",
    "response": "status 403; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/handover",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "body; schema createHandoverSchema",
    "response": "status 403/400/201"
  },
  {
    "method": "DELETE",
    "path": "/api/handover/:id",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/handover/:id/complete",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/handover/:id/read",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/handover/:id/reply",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema replyHandoverSchema",
    "response": "status 400/404/403; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/handover/image-upload",
    "handlerFile": "server/modules/handover/index.ts",
    "auth": "requireSession + imageUpload.single(\"image\")",
    "dataSource": "object storage",
    "request": "body; multipart/file",
    "response": "status 403/400/201"
  },
  {
    "method": "GET",
    "path": "/api/lane-rentals",
    "handlerFile": "server/modules/lane-rentals/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, date",
    "response": "status 400/403/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/lane-rentals",
    "handlerFile": "server/modules/lane-rentals/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertLaneRentalSchema",
    "response": "status 400/403/409/500; json DTO/entity"
  },
  {
    "method": "DELETE",
    "path": "/api/lane-rentals/:id",
    "handlerFile": "server/modules/lane-rentals/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403/500; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/lane-rentals/:id",
    "handlerFile": "server/modules/lane-rentals/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema updateLaneRentalSchema",
    "response": "status 400/404/403/409/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/lane-rentals/layout",
    "handlerFile": "server/modules/lane-rentals/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey",
    "response": "status 400/403/500; json DTO/entity"
  },
  {
    "method": "PUT",
    "path": "/api/lane-rentals/layout",
    "handlerFile": "server/modules/lane-rentals/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey; body; schema insertLaneRentalLayoutSchema",
    "response": "status 400/403/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/employee/lost-and-found",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, status, category",
    "response": "json {items}"
  },
  {
    "method": "POST",
    "path": "/api/bff/employee/lost-and-found",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "PATCH",
    "path": "/api/bff/employee/lost-and-found/:id",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema lostItemUpdateSchema",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/bff/employee/lost-and-found/:id/claim",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema claimSchema",
    "response": "status 400/404/409; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/bff/employee/lost-and-found/:id/dispose",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema disposeSchema",
    "response": "status 400/404/409; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/cleanup",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/coach-dive",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/lane-issues",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema laneIssueSchema",
    "response": "status 403/400/500; json {item}"
  },
  {
    "method": "GET",
    "path": "/api/bff/lifeguard/lane-rentals",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, date",
    "response": "json {facilityKey}"
  },
  {
    "method": "GET",
    "path": "/api/bff/lifeguard/lost-and-found",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, status, category",
    "response": "json {items}"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/lost-and-found",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "PATCH",
    "path": "/api/bff/lifeguard/lost-and-found/:id",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema lostItemUpdateSchema",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/lost-and-found/:id/claim",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema claimSchema",
    "response": "status 400/404/409; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/lost-and-found/:id/dispose",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema disposeSchema",
    "response": "status 400/404/409; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/photo-upload",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee() + upload.single(\"photo\")",
    "dataSource": "computed/static",
    "request": "body; multipart/file; schema photoMetadataSchema",
    "response": "status 400/403/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/lifeguard/records",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, days",
    "response": "json {facilityKey, waterQuality, coachDive, cleanup, lostItems, laneIssues}"
  },
  {
    "method": "POST",
    "path": "/api/bff/lifeguard/water-quality",
    "handlerFile": "server/modules/lifeguard/routes.ts",
    "auth": "deps.requireEmployee()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/notification-recipients",
    "handlerFile": "server/modules/notification-recipients/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/notification-recipients",
    "handlerFile": "server/modules/notification-recipients/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "body",
    "response": "status 400/201/500"
  },
  {
    "method": "DELETE",
    "path": "/api/notification-recipients/:id",
    "handlerFile": "server/modules/notification-recipients/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/500; json {success}"
  },
  {
    "method": "PATCH",
    "path": "/api/notification-recipients/:id",
    "handlerFile": "server/modules/notification-recipients/legacy-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/parking/contracts",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query status, vehicleId, limit",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/contracts",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertParkingContractSchema",
    "response": "status 400/500; json DTO/entity"
  },
  {
    "method": "DELETE",
    "path": "/api/parking/contracts/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 404; json {ok}"
  },
  {
    "method": "GET",
    "path": "/api/parking/contracts/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/parking/contracts/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema updateContractSchema",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/contracts/:id/issue-sign-link",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 404/409; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/contracts/:id/refund",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/contracts/:id/sign",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 404/409"
  },
  {
    "method": "POST",
    "path": "/api/parking/contracts/:id/terminate",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/parking/dashboard",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/parking/event-days",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query fromDate, toDate",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/event-days",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertParkingEventDaySchema",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "DELETE",
    "path": "/api/parking/event-days/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/parking/event-days/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/parking/payments",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query status, contractId",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/payments",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertParkingPaymentSchema",
    "response": "status 400/409; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/payments/:id/review",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema reviewPaymentSchema",
    "response": "status 400/404/409; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/parking/plans",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query includeInactive",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/plans",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertParkingPlanSchema",
    "response": "status 400/409/500; json DTO/entity"
  },
  {
    "method": "DELETE",
    "path": "/api/parking/plans/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/parking/plans/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema updatePlanSchema",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/parking/sign-tokens/:token",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "params token",
    "response": "status 400/404/410/409; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/sign-tokens/:token/finalize",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "params token; body",
    "response": "status 404/410/409"
  },
  {
    "method": "POST",
    "path": "/api/parking/sign-tokens/:token/upload-url",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db + object storage",
    "request": "params token",
    "response": "status 404/410/409; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/parking/vehicles",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query search, vehicleType, status, expiringWithinDays, limit, offset",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/parking/vehicles",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertParkingVehicleSchema",
    "response": "status 400/409/500; json DTO/entity"
  },
  {
    "method": "DELETE",
    "path": "/api/parking/vehicles/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "GET",
    "path": "/api/parking/vehicles/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/parking/vehicles/:id",
    "handlerFile": "server/modules/parking/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema updateVehicleSchema",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/supervisor/qna-review",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, limit",
    "response": "status 403/503/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/bff/supervisor/qna-review/:id/approve",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/bff/supervisor/qna-review/:id/reject",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "computed/static",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/portal/analytics",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "query sinceDays, facilityKey",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/portal/employee-resources",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, category, limit",
    "response": "status 400/403/503/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/portal/employee-resources",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertEmployeeResourceSchema",
    "response": "status 400/403/201/503/500"
  },
  {
    "method": "DELETE",
    "path": "/api/portal/employee-resources/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403/503/500; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/portal/employee-resources/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema patchSchema",
    "response": "status 400/404/403/503/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/portal/events",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertPortalEventSchema",
    "response": "status 400/204/500"
  },
  {
    "method": "GET",
    "path": "/api/portal/knowledge-base-qna",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, q, limit",
    "response": "status 400/403/503/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/portal/knowledge-base-qna",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertKnowledgeBaseQnaSchema",
    "response": "status 400/403/201/503/500; file/static"
  },
  {
    "method": "DELETE",
    "path": "/api/portal/knowledge-base-qna/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403/503/500; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/portal/knowledge-base-qna/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema patchSchema",
    "response": "status 400/404/403/503/500; json DTO/entity; file/static"
  },
  {
    "method": "POST",
    "path": "/api/portal/knowledge-base-qna/media",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "computed/static",
    "request": "body; multipart/file",
    "response": "status 400/403/201"
  },
  {
    "method": "GET",
    "path": "/api/portal/layout-settings",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, role, layoutKey",
    "response": "status 400/403/500; json {widgets, updatedAt}"
  },
  {
    "method": "PATCH",
    "path": "/api/portal/layout-settings",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema bodySchema",
    "response": "status 400/403/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/portal/quick-links",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, includeInactive",
    "response": "status 500; json {items}"
  },
  {
    "method": "POST",
    "path": "/api/portal/quick-links",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertQuickLinkSchema",
    "response": "status 400/201/500"
  },
  {
    "method": "DELETE",
    "path": "/api/portal/quick-links/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/500; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/portal/quick-links/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema quickLinkPatchSchema",
    "response": "status 400/404/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/portal/system-announcements",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, includeInactive",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/portal/system-announcements",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertSystemAnnouncementSchema",
    "response": "status 400/201/500"
  },
  {
    "method": "DELETE",
    "path": "/api/portal/system-announcements/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/500; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/portal/system-announcements/:id",
    "handlerFile": "server/modules/portal/content-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/portal/handovers",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, limit",
    "response": "status 400/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/portal/handovers",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertHandoverEntrySchema",
    "response": "status 400/201/500"
  },
  {
    "method": "DELETE",
    "path": "/api/portal/handovers/:id",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403/500; json {ok}"
  },
  {
    "method": "GET",
    "path": "/api/portal/operational-handovers",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, status, targetDate, limit",
    "response": "status 400/403; json {items}"
  },
  {
    "method": "POST",
    "path": "/api/portal/operational-handovers",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema operationalHandoverCreateBodySchema",
    "response": "status 400/403/201/500"
  },
  {
    "method": "DELETE",
    "path": "/api/portal/operational-handovers/:id",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403/500; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/portal/operational-handovers/:id",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema operationalHandoverPatchBodySchema",
    "response": "status 400/404/403/500; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/portal/operational-handovers/:id/report",
    "handlerFile": "server/modules/portal/handover-routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema operationalHandoverReportBodySchema",
    "response": "status 400/404/403/500; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/modules/:moduleId/settings",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "params moduleId",
    "response": "status 403/202"
  },
  {
    "method": "GET",
    "path": "/api/modules/health",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession",
    "dataSource": "memory/cache",
    "request": "-",
    "response": "json {role, items, undefined}"
  },
  {
    "method": "GET",
    "path": "/api/modules/home-layout",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession",
    "dataSource": "memory/cache",
    "request": "-",
    "response": "json {role, cards}"
  },
  {
    "method": "GET",
    "path": "/api/modules/navigation",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession",
    "dataSource": "memory/cache",
    "request": "-",
    "response": "json {role, items}"
  },
  {
    "method": "GET",
    "path": "/api/modules/registry",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession",
    "dataSource": "computed/static",
    "request": "-",
    "response": "json {items, visibility}"
  },
  {
    "method": "GET",
    "path": "/api/system/module-registry",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "-",
    "response": "json {items, visibility}"
  },
  {
    "method": "GET",
    "path": "/api/system/module-registry-role/:role",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params role",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/system/module-registry/:id",
    "handlerFile": "server/modules/registry/moduleRegistryController.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params id",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/action-monitoring",
    "handlerFile": "server/modules/system/action-monitoring-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "-",
    "response": "status 500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/api-monitoring",
    "handlerFile": "server/modules/system/api-monitoring-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "query projectKey",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/api-monitoring/:rowId/detail",
    "handlerFile": "server/modules/system/api-monitoring-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params rowId; query projectKey, route, label, method, status, checkedAt, durationMs, statusCode",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/bff/system/api-monitoring/error-groups/:fingerprint/status",
    "handlerFile": "server/modules/system/api-monitoring-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "params fingerprint; body",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/db-health",
    "handlerFile": "server/modules/system/api-monitoring-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/health",
    "handlerFile": "server/modules/system/api-monitoring-routes.ts",
    "auth": "public/none in route",
    "dataSource": "computed/static",
    "request": "-",
    "response": "json {status, checkedAt, service}"
  },
  {
    "method": "GET",
    "path": "/api/line-health",
    "handlerFile": "server/modules/system/api-monitoring-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/ragic-health",
    "handlerFile": "server/modules/system/api-monitoring-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Ragic/cache + memory/cache",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/cms/system/caution-permissions",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "query status, dept, q",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/cms/system/caution-permissions",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db + memory/cache",
    "request": "body; schema cautionCreateSchema",
    "response": "status 400/503"
  },
  {
    "method": "GET",
    "path": "/api/cms/system/caution-permissions/:id/audit",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params id",
    "response": "status 400/503; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/cms/system/caution-permissions/:id/log-usage",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "params id; body; schema cautionUsageSchema",
    "response": "status 400/404/201/503"
  },
  {
    "method": "PATCH",
    "path": "/api/cms/system/caution-permissions/:id/period",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db + memory/cache",
    "request": "params id; body; schema cautionPeriodPatchSchema",
    "response": "status 400/404/503; json DTO/entity"
  },
  {
    "method": "PATCH",
    "path": "/api/cms/system/caution-permissions/:id/status",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db + memory/cache",
    "request": "params id; body; schema cautionStatusPatchSchema",
    "response": "status 400/404/503; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/cms/system/caution-permissions/candidates",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + Neon via storage/db + memory/cache + mock/fallback",
    "request": "query q",
    "response": "json {sourceStatus}"
  },
  {
    "method": "GET",
    "path": "/api/cms/system/caution-permissions/check",
    "handlerFile": "server/modules/system/caution-permissions-routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "query userId",
    "response": "status 400/503; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/helper-status",
    "handlerFile": "server/modules/system/helper-status-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/line-bot/interview-users",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/line-bot/interview-users",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "DELETE",
    "path": "/api/bff/system/line-bot/interview-users/:userId",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "PATCH",
    "path": "/api/bff/system/line-bot/interview-users/:userId",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/line-bot/service-status",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority + mock/fallback",
    "request": "-",
    "response": "status 503/502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/line-bot/service-status/snapshots",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\") + inline bearer token check",
    "dataSource": "LINE proxy/LINE authority + memory/cache",
    "request": "-",
    "response": "status 503/502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/line-bot/vip-whitelist",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/line-bot/vip-whitelist",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "DELETE",
    "path": "/api/bff/system/line-bot/vip-whitelist/:id",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "PATCH",
    "path": "/api/bff/system/line-bot/vip-whitelist/:id",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "-"
  },
  {
    "method": "GET",
    "path": "/api/internal/service-health",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "inline bearer token check",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "status 503/502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/internal/service-health/snapshots",
    "handlerFile": "server/modules/system/line-bot-routes.ts",
    "auth": "inline bearer token check",
    "dataSource": "LINE proxy/LINE authority + memory/cache",
    "request": "query hours",
    "response": "status 503/502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/line-whitelist",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/line-whitelist",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + Neon via storage/db",
    "request": "body; schema lineWhitelistUpsertSchema",
    "response": "status 400/503"
  },
  {
    "method": "DELETE",
    "path": "/api/bff/system/line-whitelist/:id",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "-",
    "response": "status 405"
  },
  {
    "method": "PATCH",
    "path": "/api/bff/system/line-whitelist/:id",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "params id; body; schema lineWhitelistPatchSchema",
    "response": "status 400/404/503; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/line-whitelist/candidates",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority",
    "request": "query q",
    "response": "status 503; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/line-whitelist/import-interview-users",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority",
    "request": "-",
    "response": "status 410"
  },
  {
    "method": "GET",
    "path": "/api/internal/interview-users",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "-",
    "response": "status 503; json {total}"
  },
  {
    "method": "GET",
    "path": "/api/internal/line-whitelist/check",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority",
    "request": "query lineUserId, feature",
    "response": "status 400/503; json {allowed, entry}"
  },
  {
    "method": "GET",
    "path": "/api/system/whitelist/ragic-search",
    "handlerFile": "server/modules/system/line-whitelist-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority",
    "request": "query q",
    "response": "status 503; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/linebot-management/announcement-pipeline",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority + Google/Gemini + memory/cache + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/linebot-management/facilities",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority + memory/cache + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/linebot-management/overview",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/linebot-management/services",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/linebot-management/whitelist-comparison",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback",
    "request": "-",
    "response": "json {knownIssues}"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/linebot-management/whitelist-snapshot",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + memory/cache + mock/fallback",
    "request": "-",
    "response": "json {knownIssues}"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/linebot-management/whitelist-sync-shadow",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority",
    "request": "body",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/lineXBS-status",
    "handlerFile": "server/modules/system/linebot-management-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "LINE proxy/LINE authority + memory/cache + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/module-health/:moduleId",
    "handlerFile": "server/modules/system/module-health-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params moduleId",
    "response": "status 404/500; json {checkedAt}"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/operations/recent-assists",
    "handlerFile": "server/modules/system/operations-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "query limit",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/operations/user-search",
    "handlerFile": "server/modules/system/operations-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "query q",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/operations/user/:userId",
    "handlerFile": "server/modules/system/operations-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "params userId",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/operations/user/:userId/refresh-cache",
    "handlerFile": "server/modules/system/operations-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "memory/cache",
    "request": "params userId; body; schema refreshCacheSchema",
    "response": "status 400/404/403; json {ok}"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/operations/user/:userId/resend-notification",
    "handlerFile": "server/modules/system/operations-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params userId; body; schema resendNotificationSchema",
    "response": "status 400/404/403; json {ok, notificationStatus, errorMessage}"
  },
  {
    "method": "POST",
    "path": "/api/bff/system/operations/user/:userId/reset-session",
    "handlerFile": "server/modules/system/operations-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "params userId; body; schema opsReasonSchema",
    "response": "status 400/404/403/500; json {ok, sessionsCleared}"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/project-monitoring",
    "handlerFile": "server/modules/system/project-monitoring-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/project-monitoring/:projectKey",
    "handlerFile": "server/modules/system/project-monitoring-routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params projectKey",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/control-center",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db + memory/cache",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/api-catalog",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "apiRouteManifest + MODULE_REGISTRY + module data/integration bindings",
    "request": "-",
    "response": "json API catalog with project/feature/role/module/data-source classifications"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/health-overview",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + Neon via storage/db + memory/cache + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/insights/module/:moduleId",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "params moduleId; query period",
    "response": "status 404; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/insights/overview",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "computed/static",
    "request": "query period",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/integration-overview",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Ragic/cache + LINE proxy/LINE authority + mock/fallback",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/schedule-snapshot",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "memory/cache + mock/fallback",
    "request": "query facilityKey, from, to",
    "response": "status 502; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/watchdog-events",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "json {items}"
  },
  {
    "method": "GET",
    "path": "/api/internal/announcement-whitelist",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "-",
    "response": "json {items, total}"
  },
  {
    "method": "POST",
    "path": "/api/internal/announcement-whitelist",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "body; schema awSchema",
    "response": "status 400/409/201"
  },
  {
    "method": "DELETE",
    "path": "/api/internal/announcement-whitelist/:userId",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "params userId",
    "response": "status 400/404; json {ok, deleted}"
  },
  {
    "method": "PATCH",
    "path": "/api/internal/announcement-whitelist/:userId",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "public/none in route",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "params userId; body",
    "response": "status 400/404; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/watchdog/events",
    "handlerFile": "server/modules/system/routes.ts",
    "auth": "public/none in route",
    "dataSource": "Neon via storage/db",
    "request": "body; schema watchdogEventSchema",
    "response": "status 503/401/403/400/201"
  },
  {
    "method": "GET",
    "path": "/api/audit/logs",
    "handlerFile": "server/modules/telemetry/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "query limit",
    "response": "json {items, limit}"
  },
  {
    "method": "GET",
    "path": "/api/bff/system/ui-event-overview",
    "handlerFile": "server/modules/telemetry/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/telemetry/client-error",
    "handlerFile": "server/modules/telemetry/routes.ts",
    "auth": "inline session/facility check",
    "dataSource": "Neon via storage/db",
    "request": "body",
    "response": "status 202"
  },
  {
    "method": "GET",
    "path": "/api/telemetry/module-events",
    "handlerFile": "server/modules/telemetry/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/telemetry/training-views",
    "handlerFile": "server/modules/telemetry/routes.ts",
    "auth": "requireSession + requireRole(\"system\")",
    "dataSource": "Neon via storage/db",
    "request": "-",
    "response": "json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/telemetry/ui-events",
    "handlerFile": "server/modules/telemetry/routes.ts",
    "auth": "inline session/facility check",
    "dataSource": "Neon via storage/db",
    "request": "body",
    "response": "status 429/202"
  },
  {
    "method": "GET",
    "path": "/api/storage/objects/*splat",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "memory/cache + object storage",
    "request": "-",
    "response": "status 400/403/404; send/empty; file/static"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/assigned-tasks",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, moduleType, status, taskDate",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/assigned-tasks",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertLifeguardAssignedTaskSchema",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "DELETE",
    "path": "/api/work-logs/admin/assigned-tasks/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/work-logs/admin/assigned-tasks/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/daily-templates",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, moduleType",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/daily-templates",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertDailyTaskTemplateSchema",
    "response": "status 400; json {item}"
  },
  {
    "method": "DELETE",
    "path": "/api/work-logs/admin/daily-templates/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/work-logs/admin/daily-templates/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/daily-templates/bulk",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertDailyTaskTemplateSchema",
    "response": "status 400; json {failureCount}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/recurring-templates",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, moduleType",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/recurring-templates",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertRecurringTaskTemplateSchema",
    "response": "status 400; json {item}"
  },
  {
    "method": "DELETE",
    "path": "/api/work-logs/admin/recurring-templates/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/work-logs/admin/recurring-templates/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/recurring-templates/bulk",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertRecurringTaskTemplateSchema",
    "response": "status 400; json {failureCount}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/submissions",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, moduleType, workDate, status",
    "response": "json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/submissions/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/submissions/:id/approve",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/submissions/:id/return",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/submissions/export",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, moduleType, fromDate, toDate, workDate, status, format",
    "response": "status 400/500; send/empty; file/static"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/water-schedules",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/water-schedules",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertWaterQualityScheduleSchema",
    "response": "status 400; json {item}"
  },
  {
    "method": "DELETE",
    "path": "/api/work-logs/admin/water-schedules/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/work-logs/admin/water-schedules/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/admin/water-standards",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey",
    "response": "status 400; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/admin/water-standards",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertWaterQualityStandardSchema",
    "response": "status 400; json {item}"
  },
  {
    "method": "DELETE",
    "path": "/api/work-logs/admin/water-standards/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404; json {ok}"
  },
  {
    "method": "PATCH",
    "path": "/api/work-logs/admin/water-standards/:id",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireSupervisor()",
    "dataSource": "Neon via storage/db",
    "request": "params id; body",
    "response": "status 400/404; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/handover",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema insertLifeguardHandoverNoteSchema",
    "response": "status 400/403/500; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/handover/:id/confirm",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id; schema handoverConfirmIdSchema",
    "response": "status 400/404/403/500; json {item}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/submissions/:id/review-actions",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "params id",
    "response": "status 400/404/403/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/submit",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema submitSchema",
    "response": "status 400/403/500; json {item}"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/tasks/complete",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "body; schema completeTaskSchema",
    "response": "status 400/403/500; json {item}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/today",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, shiftType, workDate, moduleType; schema todayQuerySchema",
    "response": "status 400/403/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/upload",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "object storage",
    "request": "body; schema uploadFolderSchema",
    "response": "status 400/403; json DTO/entity; file/static"
  },
  {
    "method": "POST",
    "path": "/api/work-logs/water-quality",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "LINE proxy/LINE authority + Neon via storage/db",
    "request": "body; schema insertWaterQualityRecordSchema",
    "response": "status 400/403/500; json {item}"
  },
  {
    "method": "GET",
    "path": "/api/work-logs/water-standards",
    "handlerFile": "server/modules/work-logs/routes.ts",
    "auth": "requireEmployee()",
    "dataSource": "Neon via storage/db",
    "request": "query facilityKey, poolName",
    "response": "status 400/403/500; json DTO/entity"
  },
  {
    "method": "GET",
    "path": "/^\\/objects\\/(.+)$/",
    "handlerFile": "server/replit_integrations/object_storage/routes.ts",
    "auth": "public/none in route",
    "dataSource": "object storage",
    "request": "-",
    "response": "status 404/500; file/static"
  },
  {
    "method": "POST",
    "path": "/api/uploads/request-url",
    "handlerFile": "server/replit_integrations/object_storage/routes.ts",
    "auth": "public/none in route",
    "dataSource": "object storage",
    "request": "body",
    "response": "status 400/500; json DTO/entity"
  },
  {
    "method": "POST",
    "path": "/api/hr-audit",
    "handlerFile": "server/routes.ts",
    "auth": "public/none in route",
    "dataSource": "Ragic/cache",
    "request": "-",
    "response": "status 503"
  }
];

export const apiRouteManifestGeneratedFrom = "docs/architecture/api-inventory.md";
