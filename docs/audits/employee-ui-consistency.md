# Employee UI Consistency Audit

Date: 2026-04-30

Scope: Phase 1 T1.1, covering `client/src/modules/employee/**` and shared employee resource actions. This audit uses `ui-ux-pro-max` data-dense operations dashboard guidance and Vercel Web Interface Guidelines fetched on 2026-04-30.

## A. Page Inventory

| Route | Primary file | Status |
|---|---|---|
| `/employee` | `client/src/modules/employee/home/employee-home-page.tsx` | Existing dashboard, BFF-backed |
| `/employee/handover` | `client/src/modules/employee/handover/page.tsx` | Existing front-desk handover page |
| `/employee/activity-periods` | `client/src/modules/employee/activity-periods/page.tsx` | Enhanced in Phase 1 T1.3 |
| `/employee/activity-periods/:id` | `client/src/modules/employee/activity-periods/page.tsx` | Added detail mode in Phase 1 T1.3 |
| `/employee/announcements` | `client/src/modules/employee/announcements/page.tsx` | Existing announcement list/detail |
| `/employee/documents` | `client/src/modules/employee/documents/page.tsx` | Existing Notion-like link database |
| `/employee/training` | `client/src/modules/employee/training/page.tsx` | Existing training library |
| `/employee/personal-note` | `client/src/modules/employee/personal-note/page.tsx` | Existing sticky-note surface |
| `/employee/shift` | `client/src/modules/employee/shift/page.tsx` | Existing read-only shift surface |
| `/employee/tasks` | `client/src/modules/employee/tasks/page.tsx` | Existing task CRUD surface |

## B. Findings And Fix Strategy

### B.1 Shell Consistency

- `client/src/modules/employee/employee-shell.tsx:174` centralizes the shell, top bar, left navigation, and mobile nav. This is the correct single place for Employee page chrome.
- `client/src/modules/employee/employee-shell.tsx:58-63` defines the employee primary nav slots. It already removes `點名/報到` from primary nav and includes `員工教材`.
- `client/src/modules/employee/employee-shell.tsx:244-253` conditionally hides empty subtitles. Pages should pass `subtitle=""` when the text would be implementation commentary instead of user-facing work context.
- `client/src/modules/employee/employee-shell.tsx:287-303` truncates mobile nav labels and keeps touch targets at `min-h-12`, matching the touch target rule.

### B.2 Activity / Course Cards

- `client/src/modules/employee/activity-periods/page.tsx:49-61` already supports image-backed cards when URL is an image, but it conflated detail URL and image URL.
- `client/src/modules/employee/activity-periods/page.tsx:150` uses the same shell and dashboard chrome as other Employee pages.
- Fix applied: add first-class `imageUrl`, `eventCategory`, `eventStartAt`, and `eventEndAt` fields through schema/API/BFF and add `/employee/activity-periods/:id` detail mode.

### B.3 Training Page

- `client/src/modules/employee/training/page.tsx:164` correctly passes an empty subtitle into `EmployeeShell`, avoiding extra top-level explanation copy.
- `client/src/modules/employee/training/page.tsx:213` had implementation-source text in the empty state. Fixed in this batch with user-facing operational copy.

### B.4 Personal Notes

- `client/src/modules/employee/personal-note/page.tsx:58` used a descriptive subtitle explaining implementation behavior. Fixed in this batch by passing an empty subtitle.
- `client/src/modules/employee/personal-note/page.tsx:27-49` supports optional scheduled date/time, matching the current UX requirement.

### B.5 Shared Resource Actions

- `client/src/modules/employee/resources/employee-resource-actions.tsx:89-118` uses buttons for edit/delete actions and includes a delete confirmation state.
- `client/src/modules/employee/resources/employee-resource-actions.tsx:132-170` wraps form controls with labels and has focus styling. This matches the form accessibility rule.
- Current limitation: the generic editor supports title/content/url/scheduledAt only. Event-specific `imageUrl` and event time editing is intentionally left to the creation/detail flow until a dedicated activity editor is introduced.

## C. Phase 1 Changes Made From This Audit

- Added event metadata columns in `migrations/0004_employee_resource_event_metadata.sql`.
- Extended `employee_resources` schema and API DTOs with image URL, event category, and event start/end timestamps.
- Updated Employee BFF campaign mapping to produce stable `CampaignSummary` fields for cards and details.
- Added `/employee/activity-periods/:id` detail view without creating a duplicate `/employee/events` route.
- Kept the Employee route shape aligned with the existing registry path `/employee/activity-periods`.

## D. Residual UI Debt

- Add dedicated event editor controls for `imageUrl`, `eventCategory`, `eventStartAt`, and `eventEndAt`; current generic editor does not expose them after creation.
- Run browser screenshot review for `/employee`, `/employee/activity-periods`, `/employee/activity-periods/:id`, `/employee/training`, and `/employee/personal-note` after dev server is started.
