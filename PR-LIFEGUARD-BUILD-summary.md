# PR-LIFEGUARD-BUILD Summary

## Sub-task Status

| Sub-task | Status | Notes |
|---|---:|---|
| L0.1 Replit Object Storage 接線 | ✅ | Added `PhotoStorage` adapter with Replit SDK path and local mock fallback under `/uploads`. Wired into app container. |
| L0.2 Reverse Geocoding adapter | ✅ | Added throttled Nominatim provider. Server failures return `null` and do not block upload flow. |
| L0.3 Unified photo upload BFF endpoint | ✅ | Added `POST /api/bff/lifeguard/photo-upload` with mandatory GPS validation, server reverse geocode, storage upload, and audit. Implemented inside the lifeguard BFF route module to avoid disturbing existing BFF guard lines. |
| L1 Four new schema tables + migration | ✅ | Added four lifeguard tables and migration `0009_lifeguard_operation_modules.sql`. |
| L2 Six module pages | ✅ | Lifeguard home, three photo modules, lane issues, lost-and-found, and lane-rentals readonly views are wired. |
| L3 Employee lost-and-found entry | ✅ | Added `/employee/lost-and-found`, reusing lost-and-found flow with owner-only backend visibility. |
| L4 Supervisor observer view | ✅ | Added `/supervisor/lifeguard-overview` with grouped overview and lost-item claim/dispose actions. |
| L5 IT observer view | ✅ | Added `/system/lifeguard-audit` with filters, expandable rows, and CSV export endpoint. |
| L6 Module registry + navigation + smoke | ✅ | Registered six lifeguard modules plus supervisor/system observer modules. Updated navigation, descriptors, registry, and module smoke tests. |
| L7 Audit logs | ✅ | Added audit events for photo upload, photo module creates, lane issue create, lost item create/claim/dispose. |

## Files Changed

### L0 Infrastructure

- `server/integrations/storage/replit-object-storage.ts`
- `server/integrations/geocoding/nominatim-adapter.ts`
- `server/app/container/index.ts`
- `server/routes.ts`

### L1 Schema / Storage

- `shared/schema.ts`
- `migrations/0009_lifeguard_operation_modules.sql`
- `server/storage.ts`

### L0/L2/L4/L5 Backend Endpoints

- `server/modules/lifeguard/routes.ts`

### L2/L3 Frontend Lifeguard / Employee

- `client/src/App.tsx`
- `client/src/modules/lifeguard/home/page.tsx`
- `client/src/modules/lifeguard/lifeguard-shell.tsx`
- `client/src/modules/lifeguard/operation-modules.ts`
- `client/src/modules/lifeguard/operation-detail-page.tsx`
- `client/src/modules/lifeguard/shared/camera-capture.tsx`
- `client/src/modules/workbench/role-shell.tsx`

### L4/L5 Observer Views

- `client/src/modules/supervisor/lifeguard-overview/page.tsx`
- `client/src/modules/system/lifeguard-audit/page.tsx`

### L6 Registry / Navigation / Tests

- `shared/modules/ids.ts`
- `shared/modules/descriptors.ts`
- `shared/modules/registry.ts`
- `shared/navigation/workbench-routes.ts`
- `scripts/module-unit-tests.ts`
- `scripts/module-smoke.ts`

## Migrations Added

- `migrations/0009_lifeguard_operation_modules.sql`
  - `lifeguard_water_quality_logs`
  - `lifeguard_coach_dive_logs`
  - `lifeguard_cleanup_logs`
  - `lifeguard_lost_and_found`

## New BFF Endpoints

- `POST /api/bff/lifeguard/photo-upload`
- `POST /api/bff/lifeguard/water-quality`
- `POST /api/bff/lifeguard/coach-dive`
- `POST /api/bff/lifeguard/cleanup`
- `POST /api/bff/lifeguard/lane-issues`
- `POST /api/bff/lifeguard/lost-and-found`
- `GET /api/bff/lifeguard/records`
- `GET /api/bff/lifeguard/lost-and-found`
- `POST /api/bff/lifeguard/lost-and-found/:id/claim`
- `POST /api/bff/lifeguard/lost-and-found/:id/dispose`
- `GET /api/bff/lifeguard/lane-rentals`
- `GET /api/bff/supervisor/lifeguard-overview`
- `GET /api/bff/system/lifeguard-audit`
- `GET /api/bff/system/lifeguard-audit?format=csv`

## New Module Registry Entries

- `lifeguard-water-quality`
- `lifeguard-coach-dive`
- `lifeguard-cleanup`
- `lifeguard-lane-issues`
- `lifeguard-lost-and-found`
- `lifeguard-lane-rentals`
- `supervisor-lifeguard-overview`
- `system-lifeguard-audit`

## Verification

```text
npm run type-check      PASS
npm run unit:modules    PASS
npm run check:modules   PASS
npm run smoke:modules   PASS
npm run dry-run         PASS
```

`dry-run` completed type-check, module registry check, smoke, unit modules, client build, and server build.

Build warnings observed but non-blocking:

- Browserslist/caniuse-lite data is stale.
- PostCSS plugin warning about missing `from` option.
- Vite chunk size warning for the main client bundle.

## Halt Decisions

- No full-batch halt.
- L2.5 deviation: the repo does not expose a generic `work_logs` table in the shared schema. Lane issues are stored through the existing lifeguard handover-note/work-log surface (`lifeguard_handover_notes`) with category and metadata fields, so the flow remains facility scoped and auditable.
- Client-side reverse geocoding uses direct browser `fetch` to Nominatim as requested. Browser code cannot set a real `User-Agent` header; server-side geocoding does set `User-Agent: Junsz-CMS/1.0`.

## Out of Scope Findings

- `npm run db:push --force` was not executed in this local batch. Apply migrations in Replit/target DB before acceptance.
- Real GPS/camera/Object Storage behavior still needs HTTPS mobile validation on Replit.
- Object Storage falls back to local mock URLs outside Replit so local development does not block.
- Existing pre-batch local changes remain present, including `server/modules/announcement-overlays/routes.ts` and `.playwright-mcp/`; they were not staged, committed, pushed, or reverted.

## Replit Acceptance Steps

1. 套用所有 migrations.
2. 救生員手機登入 `/lifeguard`.
3. 拒絕 GPS permission → 應跳 blocker，不能進拍照。
4. 允許 GPS → 拍水質檢測照片 → 浮水印含時間、GPS、地址。
5. 上傳成功後到 Replit Object Storage 確認 file 存在。
6. SQL 驗 audit row：

   ```sql
   SELECT action, payload, created_at
   FROM audit_logs
   WHERE action LIKE 'LIFEGUARD_%'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

7. 失物招領完整流程：新增 → 主管認領 → status 變 `claimed`.
8. 主管端 `/supervisor/lifeguard-overview` 看得到該救生員紀錄。
9. IT 端 `/system/lifeguard-audit` 篩選驗證。
