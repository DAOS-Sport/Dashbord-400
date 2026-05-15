# Replit Acceptance Checklist

Use this after pushing/pulling the current branch into Replit. Local dry-run proves build health, but these items require the deployed Replit environment, HTTPS, real browser permissions, Object Storage, and database migrations.

## Pre-flight

1. Pull the intended branch/commit into Replit.
2. Confirm secrets/env are present:
   - `DATABASE_URL`
   - `LINE_BOT_ADMIN_TOKEN` if validating LINE group announcements
   - Replit Object Storage sidecar/bucket availability
3. Apply migrations:

   ```bash
   npm run db:push --force
   ```

4. Run local Replit gates:

   ```bash
   npm run type-check
   npm run check:workbench-governance
   npm run dry-run
   ```

## Workbench Route Smoke

| Area | URL | Expected |
|---|---|---|
| Employee | `/employee` | Employee shell, dashboard cards, no quick-action rail gap |
| Lifeguard | `/lifeguard` | Lifeguard shell, six module cards, facility/shift summary |
| Supervisor | `/supervisor` | Supervisor shell, no white legacy sidebar |
| System | `/system` | System shell, audit/integration tools |
| Legacy parking | `/admin/parking/dashboard` | Redirects to `/supervisor/parking` |
| Legacy courts | `/courts/xinbei` | Redirects to `/supervisor/courts/xinbei` |

## Lifeguard Mobile Acceptance

Use a real phone over HTTPS.

1. Login as a lifeguard user.
2. Open `/lifeguard`.
3. Verify the six module cards:
   - 水質檢測
   - 教練下水
   - 下班打掃
   - 水道事項
   - 失物招領登記
   - 水道租借狀態
4. Open `/lifeguard/water-quality`.
5. Deny GPS permission.
   - Expected: full blocker state, cannot take photo.
6. Re-enable GPS permission.
7. Take a photo.
   - Expected: watermark includes Taipei time, GPS coordinates, and address/fallback address text.
8. Upload.
   - Expected: success state and Object Storage file exists.
9. Repeat one quick upload for:
   - `/lifeguard/coach-dive`
   - `/lifeguard/cleanup`
10. Open `/lifeguard/lane-issues`, submit one text issue.
11. Open `/lifeguard/lost-and-found`, create one lost item.
12. Open `/lifeguard/lane-rentals`, confirm readonly grid has no edit controls.

## Supervisor Acceptance

1. Login as supervisor.
2. Open `/supervisor/lifeguard-overview`.
3. Confirm today's lifeguard records appear by facility.
4. Open a photo record drawer.
   - Expected: full photo visible with watermark.
5. Claim or dispose a test lost item.
   - Expected: status updates and audit row is recorded.

## System / IT Acceptance

1. Login as system.
2. Open `/system/lifeguard-audit`.
3. Filter by facility, module, date range, and claim status.
4. Expand a row.
   - Expected: metadata, GPS, client/server address comparison, and audit reference.
5. Export CSV.
6. Open `/system/audit` and verify recent actions:

   ```sql
   SELECT action, payload, created_at
   FROM audit_logs
   WHERE action LIKE 'LIFEGUARD_%'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

## Announcement Groups Acceptance

1. Open `/supervisor/announcement-groups`.
2. Add a facility to LINE group binding.
3. Test fetch.
4. Switch employee active facility.
5. Open `/employee`.
   - Expected: group important announcements reflect the active facility binding.

## Pass / Fail Notes

- GPS only works reliably in HTTPS contexts.
- Camera and GPS prompts are separate browser permission prompts.
- Nominatim is rate-limited; slow address resolution should not block upload.
- Object Storage falls back locally, but Replit must validate real bucket persistence.
