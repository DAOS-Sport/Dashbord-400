# PR-LIFEGUARD-MOBILE-UX Summary

## Files Changed

- `client/src/modules/lifeguard/lifeguard-shell.tsx`
  - Rebuilt mobile header into a 64px duty status banner with facility, shift, and user name.
  - Replaced the old five-slice bottom navigation with four primary actions plus a "more" sheet.
  - Added mobile hamburger drawer with facility switcher, role switcher, full module list, and logout.
  - Preserved desktop sidebar/topbar behavior behind `lg:` breakpoints.

- `client/src/modules/lifeguard/home/page.tsx`
  - Added a mobile-only OpenPoint-style home layout: dark hero card, three large action cards, quick chips, and today summary.
  - Mobile actions now navigate directly to detail pages instead of opening the preview drawer.
  - Kept the existing desktop module preview cards, floating actions, and drawer as desktop-only.

- `client/src/modules/lifeguard/shared/camera-capture.tsx`
  - Reworked GPS loading, blocked, ready, preview, upload, failure, and success states for mobile-first use.
  - Enlarged camera CTA, stacked preview actions vertically, added fake upload progress, and preserved photo blobs for retry.
  - Kept the existing GPS requirement, watermark canvas flow, and `/api/bff/lifeguard/photo-upload` contract.

## Before / After

- Before: mobile lifeguard home reused desktop-oriented module preview/drawer language, with dense status cards and duplicated floating entry points.
- After: mobile home starts with duty status, then three large direct-action cards for water quality, photo work, and lost-and-found, followed by quick chips and daily counts.
- Before: camera preview used compact button groups and minimal upload feedback.
- After: camera flow has clear GPS blockers, a 200px camera CTA, vertical action buttons, upload progress, retry, and success states.

## Touch Target Sizes

- Mobile header hamburger and notification: `56px`.
- Bottom nav tabs: `min-h-[64px]`.
- Primary middle bottom action: `min-h-[64px]` with enlarged icon.
- Mobile home primary card CTA: `min-h-[48px]`.
- Mobile quick chips: `min-h-[56px]`.
- Camera button: `min-h-[200px]`.
- Confirm upload / retry primary actions: `min-h-[64px]`.
- Secondary camera actions: `min-h-[56px]`.

## Desktop Regression Confirmation

- `lifeguard-shell.tsx` desktop sidebar/topbar remains `lg:flex` / `lg:block`.
- `home/page.tsx` desktop module cards, desktop drawer, and `FloatingQuickActionsPanel` are kept in a `hidden lg:block` branch.
- `camera-capture.tsx` contract and logic are unchanged at the API/watermark level; only the rendered states were expanded.

## Verification

- `npm run type-check` passed.
- `npm run check` passed.
- `npm run smoke:modules` passed.
- `npm run unit:modules` passed.
- `npm run check:modules` passed.
- `git diff --check` passed for the edited lifeguard UI files.
- Browser smoke at `390x844` attempted `/lifeguard`; current Playwright browser session redirected to `/login` because it has no auth cookie. This is expected without logging in through the browser session.

## Halt Decisions

- No halt. The change stayed frontend-only and did not touch schema, migrations, or BFF contracts.

## Out of Scope Findings

- Real upload progress is still simulated because `fetch` does not expose native upload progress events. A future XHR upload wrapper can replace the fake progress if exact percentages become required.
- Mobile GPS status on the home hero may trigger a browser permission prompt before entering a capture page. This matches the requested status banner behavior but should be checked on real devices.
- Human mobile acceptance is still needed on iPhone Safari and Android Chrome because local Playwright could not access an authenticated lifeguard session.
