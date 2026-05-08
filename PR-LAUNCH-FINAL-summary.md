# PR Launch Final Summary

## Sub-task Status
- F1 (employee sidebar cleanup): ✅
- F2 (active facility shift filtering): ✅
- F3 (supervisor hard-code cleanup): ✅
- F4 (module health telemetry_pending): ✅
- M2 (announcement policy alignment): ✅
- L1 (lifeguard role): ✅

## Files Changed

### F1 - Employee sidebar cleanup
- `client/src/modules/employee/employee-shell.tsx`
- `client/src/modules/employee/home/employee-home-page.tsx`

### F2 - Shift active facility filtering
- `server/modules/bff/routes.ts`
- `shared/domain/workbench.ts`

### F3 - Supervisor hard-code cleanup
- `client/src/modules/workbench/role-shell.tsx`
- `server/modules/bff/employee-home.ts`

### F4 - Module health telemetry_pending
- `shared/modules/types.ts`
- `shared/modules/descriptors.ts`
- `client/src/modules/system/dashboard-page.tsx`

### M2 - Announcement policy alignment
- `server/modules/bff/routes.ts`
- `shared/domain/workbench.ts`
- `scripts/module-smoke.ts`

### L1 - Lifeguard role
- `client/src/App.tsx`
- `client/src/modules/lifeguard/lifeguard-shell.tsx`
- `client/src/modules/lifeguard/home/page.tsx`
- `client/src/modules/lifeguard/log/page.tsx`
- `client/src/modules/workbench/role-switcher.tsx`
- `server/integrations/ragic/auth-adapter.ts`
- `server/integrations/ragic/mock-auth-adapter.ts`
- `server/integrations/ragic/real-auth-adapter.ts`
- `server/modules/auth/routes.ts`
- `server/modules/auth/session-store.ts`
- `server/modules/bff/routes.ts`
- `server/modules/registry/moduleRegistryController.ts`
- `server/modules/work-logs/routes.ts`
- `server/routes.ts`
- `server/shared/data/write-metadata.ts`
- `shared/auth/me.ts`
- `shared/modules/descriptors.ts`
- `shared/modules/ids.ts`
- `shared/modules/registry.ts`
- `shared/modules/types.ts`
- `shared/schema.ts`
- `scripts/module-registry-check.ts`
- `scripts/module-smoke.ts`
- `scripts/module-unit-tests.ts`

## Verification
- dry-run: pass
- command: `npm run dry-run`
- gates included: type-check, check:modules, smoke:modules, unit:modules, build
- hard-code check: `rg -n "台中館|台中|taichung" client/src server shared scripts docs -S` returned no matches
- diff hygiene: `git diff --check` pass

## Four-role User Journey
- employee: sidebar only exposes implemented employee entries; lifeguard log removed from employee navigation -> ✅
- lifeguard: `/lifeguard`, `/lifeguard/home`, `/lifeguard/log` route into LifeguardShell and lifeguard home/log views -> ✅
- supervisor: active facility label is dynamic instead of hard-coded 台中館 -> ✅
- system: module health distinguishes `telemetry_pending` from real `degraded` -> ✅
- test credentials: `1111 / 1111` are supported in mock/dev auth and grant employee + lifeguard + supervisor + system roles -> ✅

## Halt Decisions
- None.

## Out of Scope Findings
- Lifeguard log persistence continues to use the existing work-log storage/schema tables, with lifeguard-only UI route and audit actions added. A future cleanup can physically split shared work-log internals under `server/modules/lifeguard/` if the project wants stricter folder ownership.

## Replit Acceptance Steps
1. Apply all pending migrations.
2. Login with `1111 / 1111` and confirm role switcher contains employee, lifeguard, supervisor, system.
3. Confirm employee sidebar no longer shows lifeguard log or unfinished booking/tutor entries.
4. Confirm `/lifeguard/home` and `/lifeguard/log` render under LifeguardShell.
5. Create a lifeguard handover log and verify audit rows:
   ```sql
   select action, actor_user_id, created_at
   from audit_logs
   where action in ('LIFEGUARD_LOG_CREATED', 'LIFEGUARD_LOG_UPDATED')
   order by created_at desc
   limit 20;
   ```
6. Confirm `/api/bff/employee/shifts/today` only returns rows matching the active facility.
7. Confirm `/api/bff/employee/announcements` shows active announcements without duplicates.
