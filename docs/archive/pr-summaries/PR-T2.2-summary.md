# PR-T2.2: Supervisor Home Overview

## Files Changed

- `shared/domain/workbench.ts` — added `SupervisorFacilityOverview` and optional `facilities` section on `SupervisorDashboardDto`.
- `server/modules/bff/employee-home.ts` — mock supervisor dashboard includes facility overview rows.
- `server/modules/bff/routes.ts` — `/api/bff/supervisor/dashboard` now aggregates authorized facility cards from staffing, tasks, and operational handovers.
- `client/src/modules/supervisor/dashboard-page.tsx` — added four-column facility overview grid with current lead, staffing, open handovers, and incomplete tasks.

## Verification

- type-check: pass
- check: pass
- smoke:modules: pass
- check:modules: pass
- build: pass

## Notes

- No new table was introduced.
- The supervisor overview uses existing `grantedFacilities` and does not fall back to unauthorized facilities when a session has grants.
- Facility detail route remains out of scope for this batch.
- Build still emits pre-existing warnings for Browserslist age, PostCSS `from`, and large chunk size; no new build failure.
