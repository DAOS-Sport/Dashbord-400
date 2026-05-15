# PR-T1.1 / T1.3: Employee UI Consistency + Event Card Enhancement

## Files Changed

- `docs/audits/employee-ui-consistency.md` — Phase 1 Employee UI audit and residual debt list.
- `migrations/0004_employee_resource_event_metadata.sql` — additive event metadata columns for `employee_resources`.
- `shared/schema.ts` — event metadata fields and insert validation.
- `shared/domain/workbench.ts` — extended `CampaignSummary` contract.
- `server/modules/bff/routes.ts` — maps event metadata into Employee BFF campaign DTOs.
- `server/routes.ts` — accepts event metadata in employee resource updates.
- `server/storage.ts` — sorts employee resources with event start time before scheduled time.
- `client/src/modules/employee/home/api.ts` — client DTO and resource create/update payload support.
- `client/src/modules/employee/activity-periods/page.tsx` — image-backed cards, event metadata create form, and detail view.
- `client/src/App.tsx` — added `/employee/activity-periods/:id` route.

## Verification

- type-check: pass
- check: pass
- smoke:modules: pass
- check:modules: pass
- build: pass
- browser: pass (`/employee/activity-periods` and `/employee/activity-periods/camp-1` render without crash)

## Notes

- Existing `/employee/activity-periods` remains the canonical route. No duplicate `/employee/events` route was introduced.
- The new fields are nullable and backward compatible. Existing event rows continue to render from `content`, `subCategory`, and `url`.
- Event-specific edit controls are not added to the generic resource editor yet; this is listed as residual UI debt.
- Build still emits pre-existing warnings for Browserslist age, PostCSS `from`, and large chunk size; no new build failure.
- Browser screenshots were generated for verification and then removed from the worktree.
