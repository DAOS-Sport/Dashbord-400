# Module Registry Guide

## Purpose

The Module Registry is the single ownership map for UI routes, BFF sections, local APIs, DB bindings, integrations, permissions, telemetry, and completion status.

New UI is not considered complete unless the module is registered and exposed through the BFF or an explicit `not_connected` DTO.

## Runtime APIs

- `GET /api/modules/registry`: role-filtered module descriptors. `system` receives technical fields.
- `GET /api/modules/navigation`: sidebar/navigation DTO for the active backend session role.
- `GET /api/modules/home-layout`: registry-driven home-card layout for modules that are at least `bff-wired`.
- `GET /api/modules/health`: module health with route/BFF/permission/telemetry checks.
- `PATCH /api/modules/:moduleId/settings`: registered system-only settings entrypoint; persistence is reserved for `module_settings`.
- `GET /api/bff/employee/handover/summary`: employee front-desk handover summary for home/drawer.
- `GET /api/bff/employee/handover/list`: employee front-desk handover list grouped by derived pending/completed/expired status.
- `POST /api/handover` and `PATCH /api/handover/:id/complete`: employee same-facility handover create/complete API.
- `GET /api/bff/employee/shifts/today`: employee ShiftBoard DTO; external schedule data remains read-only.

## Descriptor Rules

Each module descriptor must define:

- stable `id`
- role list
- route path when `navVisible=true`
- BFF endpoint when `cardVisible=true`
- required permissions
- search keywords
- telemetry events
- empty and not-connected copy

Lifecycle:

- `planned`: registered only, not connected
- `ui-only`: page shell exists but runtime contract is incomplete
- `api-wired`: API exists but home/dashboard cannot consume it yet
- `bff-wired`: may appear on home/system views as `incomplete`
- `production-ready`: full runtime path is allowed

`planned`, `ui-only`, and `api-wired` modules must not appear as live dashboard cards. `planned` modules must render as `not_connected`; they must not return fake product data.

## BFF Rules

Frontend pages should consume BFF/API from this app only.

Employee home currently returns both legacy section fields and stable execution-layer fields:

- `homeCards.todayTasks`
- `homeCards.announcements`
- `homeCards.handover`
- `homeCards.quickActions`
- `homeCards.shiftReminder`
- `homeCards.bookingSnapshot`

Legacy aliases remain during migration:

- `todayTasks`
- `handoverSummary`
- `importantAnnouncements`
- `quickActions`
- `todayShift`
- `weatherCard`
- `navigation`
- `unreadCounts`

When a source fails, BFF returns `empty`, `not_connected`, or degraded section metadata instead of letting the whole page fail.

Employee navigation is intentionally role-curated. The employee sidebar order is:

1. `employee-home`
2. `handover`
3. `activity-periods`
4. `employee-resources`
5. `personal-note`
6. `knowledge-base-qna`
7. `checkins`

Do not add employee sidebar items by editing components. Update the module descriptor and the employee navigation policy in `shared/modules/descriptors.ts`.

`handover` has two UI labels by design:

- Sidebar destination: `櫃台交接`
- Home card/action context: `櫃台交辦`

`shift-reminder` is read-only. The frontend must consume `ShiftBoardDto` from BFF and must not call Smart Schedule or external schedule APIs directly.

Quick actions are BFF-owned defaults. The employee UI may store personal shortcut order, label, href, and tone in localStorage as a UI preference only; cross-device persistence should later move to `module_settings`, `widget_layout_settings`, or a dedicated quick-link settings table.

## Permission Rules

Backend session truth is authoritative:

- `activeRole`
- `activeFacility`
- `grantedRoles`
- `grantedFacilities`

Frontend must not store role/facility/session authority in localStorage. Theme/UI preferences are allowed.

## Telemetry Rules

Use `useTrackEvent()` for non-blocking UI events:

- `PAGE_VIEW`
- `NAV_CLICK`
- `CARD_CLICK`
- `VIEW_ALL_CLICK`
- `ROLE_SWITCH_CLICK`
- `FACILITY_SWITCH`
- `SEARCH_SUBMIT`
- `MODULE_HEALTH_VIEW`
- `ACTION_SUBMIT`

Failed telemetry dispatch must not break the user action.

## Smoke Gate

Run before deploy:

```bash
npm run type-check
npm run build
npm run smoke:modules
```

`smoke:modules` verifies registry uniqueness, role navigation, home-card DTO presence, role isolation, localStorage authority rules, no frontend direct external API calls, and BFF/search endpoint registration.
