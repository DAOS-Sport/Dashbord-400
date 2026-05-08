# Final Closure Batch Summary

Baseline: `git status -s` was recorded before this batch. The repo already had uncommitted closeout changes from the prior batch; this batch did not run `git add` or `git commit`.

## Sub-task Status

- M1 (personal-note owner): ✅
- M2 (announcement unified): ⚠️
- M3 (qna supervisor review): ✅
- M4 (not_connected UX): ✅

## Files Changed

### M1 - personal-note owner policy

- `shared/employee-resources/privacy.ts`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/modules/employee/personal-note/page.tsx`
- `scripts/module-unit-tests.ts`

### M2 - announcement unified policy

- No code changed.
- Halted because the required employee announcement BFF aggregation lives in `server/modules/bff/routes.ts`, which this batch explicitly forbids modifying.
- Existing evidence: current BFF already merges local `system_announcements` with LINE candidate fallback and uses `uniqueAnnouncements`, but endpoint-level policy changes were not made because of the locked file rule.

### M3 - Q&A supervisor review

- `shared/schema.ts`
- `migrations/0007_qna_supervisor_review.sql`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/App.tsx`
- `client/src/modules/employee/home/api.ts`
- `client/src/modules/employee/qna/page.tsx`
- `client/src/modules/supervisor/qna-review/page.tsx`
- `scripts/module-unit-tests.ts`

### M4 - not_connected UX

- `client/src/components/shared/not-connected-card.tsx`
- `client/src/modules/employee/home/employee-home-page.tsx`
- `client/src/modules/employee/more/page.tsx`
- `scripts/module-unit-tests.ts`

## Verification

- dry-run: pass
- command: `npm run dry-run`
- gates passed:
  - type-check
  - check:modules
  - smoke:modules
  - unit:modules
  - build

## 三角色 User Journey 驗證

- employee：建 sticky note -> 自己看到、其他人看不到 -> ✅ automated owner-policy regression; Replit manual pending
- employee：看公告 -> 不重複、不漏 -> ⚠️ M2 halted by locked BFF file; existing BFF merge/dedupe remains unchanged
- employee：建 Q&A -> pending 狀態 -> 主管 approve -> 公開 -> ✅ automated route/schema/source regression; Replit manual pending
- supervisor：qna-review 頁面看到 pending -> 可 approve / reject -> ✅ route and UI added; Replit manual pending
- any: not_connected widget 顯示一致、不像壞掉 -> ✅ shared component and source regression; browser reached login but authenticated page visual check remains manual

## Skipped Items

- M2 endpoint-level announcement policy changes were skipped because `server/modules/bff/routes.ts` is explicitly out of bounds for this batch.
- M4 authenticated visual inspection was not completed in browser because `/employee/checkins` correctly redirected to `/login`; no test credentials were driven through the browser tooling. The dev server did start and was stopped afterward.

## Halt Decisions

- M2 halted at sub-task level. Changing `/api/bff/employee/announcements` or the employee home announcement aggregator requires touching the locked BFF route file, so this cannot be safely completed inside this batch's rules.

## Out of Scope Findings

- `server/modules/bff/routes.ts` is still the owner surface for announcement policy and employee home sticky-note composition. A follow-up should unlock that file if the team wants endpoint-level M2 completion or homepage sticky-note owner injection.
- The Q&A review route is intentionally direct at `/supervisor/qna-review`; it was not added to the fixed supervisor navigation contract to avoid changing the prior homepage/navigation alignment scope.

## Replit Acceptance Steps (for human)

1. Apply migrations `0005`, `0006`, and `0007`.
2. Three-role login test:
   - employee creates sticky note and confirms another employee cannot see it.
   - employee creates Q&A and sees pending/rejected badge.
   - supervisor opens `/supervisor/qna-review`, approves/rejects pending Q&A.
   - employee confirms approved Q&A is public.
   - not_connected weather/check-in/booking/shift surfaces render as neutral pending/sync states.
3. SQL verify `audit_logs` contains `QNA_APPROVED` / `QNA_REJECTED`.
4. SQL verify sticky notes have correct `created_by_employee_number`.
5. Run `npm run check:training-flow` in deployed environment.
