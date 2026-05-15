# Workbench Governance Closeout

This is the short entry point for the five cleanup tracks requested after the current module build.

## Tracks

| Track | Document | Automated Gate |
|---|---|---|
| 權限矩陣 | `docs/governance/WORKBENCH_PERMISSION_MATRIX.md` | `npm run check:workbench-governance` |
| 路由總表 | `docs/governance/WORKBENCH_ROUTE_MAP.md` | `npm run check:workbench-governance` |
| Module registry 對照實際頁面 | `docs/governance/MODULE_REGISTRY_PAGE_AUDIT.md` | `npm run check:modules`, `npm run check:workbench-governance` |
| 模組母系統歸屬 | `/system/function-relations` + `shared/modules/architecture.ts` | `npm run check:modules`, `npm run check:workbench-governance` |
| Replit 真機驗收 | `docs/integrations/REPLIT_ACCEPTANCE_CHECKLIST.md` | Manual Replit + mobile HTTPS acceptance |
| Legacy runtime 清除 | `docs/operations/LEGACY_RUNTIME_CLEANUP.md` | `npm run smoke:modules`, `npm run dry-run` |

## Current Completion Estimate

| Area | Completion | Reason |
|---|---:|---|
| Role shell / entry architecture | 85% | Four role shells are clear and guarded by route tests. |
| Route manifest | 85% | Canonical routes are centralized; legacy redirects remain for compatibility. |
| Module registry alignment | 80% | Registry and descriptors are test-covered; some legacy implementation pages are intentionally reused. |
| Permission matrix | 70% | Role-level matrix is documented; endpoint-level authorization should be reviewed once more after Replit acceptance. |
| Replit acceptance | 40% | Local dry-run passes; mobile GPS, camera, Object Storage, and DB migrations need Replit validation. |
| Legacy runtime cleanup | 65% | Main runtime no longer uses the old shell; physical deletion remains deferred until acceptance. |

## Operating Rules Going Forward

1. Add new pages through `shared/navigation/workbench-routes.ts` first.
2. Add or update module IDs in `shared/modules/ids.ts`.
3. Register module metadata in `shared/modules/registry.ts`.
4. Confirm the module falls into one mother-system group through `shared/modules/architecture.ts`.
5. Add role-specific visibility in `shared/modules/descriptors.ts`.
6. Mount the page in `client/src/App.tsx` under the correct role shell.
7. Add or update tests in `scripts/module-unit-tests.ts`, `scripts/module-smoke.ts`, or `scripts/workbench-governance-check.ts`.
8. Run `npm run dry-run` before pushing to Replit.

## Mother-System Classification

Every module must be assigned by code, not by visual placement alone. The shared classifier is `shared/modules/architecture.ts`, and `/system/function-relations` renders the same grouping for IT review.

Current groups:

- `entry-identity`: login, role, facility, home shells, session and role snapshots.
- `employee-content`: employee daily content, resources, training, notes, checkins, search and not-connected cards.
- `lifeguard-workflows`: lifeguard operation modules, supervisor overview and system lifeguard audit.
- `supervisor-operations`: parking, counter logs, lane rentals, courts, tasks, handover, anomalies and reports.
- `announcements`: announcements, announcement groups, overlays, notification recipients and Q&A.
- `system-governance`: topology, function relations, health, audit, raw inspector, watchdog and projections.
- `integrations`: LINE, schedule, Ragic, Gmail and integration sync jobs.
- `portal-legacy`: legacy portal and compatibility-only storage/API surfaces.

Modules without BFF binding are acceptable only when they are background, integration, legacy, external or deprecated. `check:modules` and `check:workbench-governance` now fail if a user-facing module becomes suspiciously unbound.

## Current Gate

```bash
npm run check:workbench-governance
npm run dry-run
```
