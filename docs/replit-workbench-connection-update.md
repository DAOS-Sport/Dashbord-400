# Replit Workbench Connection Update

Last updated: 2026-04-24

This document records the current 400qian-duan-yi-biao-ban connection contract for Replit deployment and external data reconnection.

## Required env

```text
DATA_SOURCE_MODE=real
DATABASE_PROFILE=neon
DATABASE_URL=<Neon/Postgres URL>
SESSION_SECRET=<session secret>
INTERNAL_API_TOKEN=0935314711

RAGIC_ADAPTER_MODE=real
RAGIC_API_KEY=<Ragic Basic token>
RAGIC_HOST=ap7.ragic.com
RAGIC_ACCOUNT_PATH=xinsheng
RAGIC_EMPLOYEE_SHEET=/ragicforms4/13
RAGIC_FACILITY_SHEET=/ragicforms4/7

REPLIT_DATA_ADAPTER_MODE=real
LINE_BOT_BASE_URL=https://line-bot-assistant-ronchen2.replit.app
LINE_BOT_INTERNAL_TOKEN=0935314711

SCHEDULE_ADAPTER_MODE=real
SMART_SCHEDULE_BASE_URL=https://smart-schedule-manager.replit.app
SMART_SCHEDULE_API_TOKEN=0935314711

EXTERNAL_API_TIMEOUT_MS=10000
```

## Database sync

After pulling this version on Replit, run:

```bash
npm run db:push
```

New tables in this update:

| table | purpose |
| --- | --- |
| `widget_layout_settings` | Stores role/facility dashboard widget visibility and order. |
| `watchdog_events` | Stores future external watchdog service events. |
| `employee_resources` | Stores employee-created events/course links, common documents, and sticky notes. |

Existing `portal_events` now accepts:

```text
layout_update
widget_click
search
resource_create
```

## New internal and BFF routes

| route | auth | purpose |
| --- | --- | --- |
| `GET /api/portal/layout-settings?facilityKey=&role=employee&layoutKey=employee-home` | employee session | Read employee homepage widget layout. |
| `PATCH /api/portal/layout-settings` | supervisor session | Save widget layout and apply to employee home. |
| `GET /api/bff/employee/search?q=&facilityKey=` | employee session | Fuzzy search announcements, handover, tasks, shifts, shortcuts, documents. |
| `GET /api/portal/employee-resources?facilityKey=&category=` | employee session | Read employee-created `event` / `document` / `sticky_note` resources. |
| `POST /api/portal/employee-resources` | employee session | Add employee-created events/course links, documents, or sticky notes. |
| `PATCH /api/portal/employee-resources/:id` | owner or supervisor session | Edit employee-created resources. |
| `DELETE /api/portal/employee-resources/:id` | owner or supervisor session | Delete employee-created resources. |
| `GET /api/bff/system/schedule-snapshot?facilityKey=&from=&to=` | system session | Local BFF debug view of Smart Schedule export snapshot. |
| `POST /api/watchdog/events` | `X-Internal-Token` / Bearer / `X-API-Key` | Future watchdog ingestion. JSON only. |
| `GET /api/bff/system/watchdog-events` | system session | Read latest watchdog events. |

## External source mapping

| UI module | BFF source order |
| --- | --- |
| Employee announcements | LINE Bot internal facility home first, Portal system announcements and announcement candidates fallback. |
| Employee handover / handoff | Portal `operational_handovers` + Portal `handover_entries`. |
| Employee today shifts | Smart Schedule export `/api/internal/export/snapshot`, then fallback to `/api/internal/schedules/today`. BFF filters facility aliases, rest days, cancelled/deleted rows. |
| Employee events/documents/sticky notes | Local Portal DB `employee_resources`, written by employee session, then rendered by employee BFF. |
| Supervisor staffing | Ragic active employees + Smart Schedule current/next shifts. |
| Supervisor widget control | `widget_layout_settings`, then normalized default layout fallback. |
| System health | local config + integration overview + future watchdog events. |

## Watchdog event example

```bash
curl -X POST "$APP_URL/api/watchdog/events" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: 0935314711" \
  -d '{
    "source": "smart-schedule",
    "serviceName": "schedule-api",
    "status": "ok",
    "severity": "info",
    "message": "Internal schedule API reachable",
    "payload": { "latencyMs": 120 }
  }'
```

## Employee search example

```bash
curl "$APP_URL/api/bff/employee/search?q=交接&facilityKey=xinbei_pool" \
  -H "Cookie: workbench_sid=<session>"
```

The response shape is:

```json
{
  "query": "交接",
  "items": [
    {
      "id": "handover-1",
      "type": "handover",
      "title": "晚班交接",
      "summary": "內容摘要",
      "href": "/employee/handover"
    }
  ]
}
```
