# Legacy Runtime Cleanup

This document separates legacy compatibility from runtime ownership. The goal is to keep old bookmarks working while preventing old UI shells and duplicate module entry points from coming back.

## Current Policy

- Legacy URLs are allowed only as redirects.
- Legacy page components may be reused internally if wrapped by the current workbench shell.
- Legacy white admin shell must not be rendered from `App.tsx`.
- New official routes must live under:
  - `/employee`
  - `/lifeguard`
  - `/supervisor`
  - `/system`

## Already Disconnected From Main Runtime

| Legacy Surface | Current State | Guard |
|---|---|---|
| `AppSidebar` white shell | Not imported/rendered by `App.tsx` | `npm run smoke:modules` |
| `SidebarProvider` fallback | Not imported/rendered by `App.tsx` | `npm run smoke:modules` |
| `/admin/parking/*` | Redirects to `/supervisor/parking/*` | `getRedirectForLegacyPath` |
| `/admin/counter-logs/*` | Redirects to `/supervisor/counter-log/*` | `getRedirectForLegacyPath` |
| `/admin/lane-rentals` | Redirects to `/supervisor/lane-rentals` | `getRedirectForLegacyPath` |
| `/courts/*` | Redirects to `/supervisor/courts/*` | `getRedirectForLegacyPath` |
| `/analytics` | Redirects to `/supervisor/reports` | `getRedirectForLegacyPath` |
| `/operations` | Redirects to `/supervisor` | `getRedirectForLegacyPath` |

## Keep For Now

| Files / Surface | Why Kept |
|---|---|
| `client/src/pages/admin/parking/*` | Implementation pages are reused inside `SupervisorModuleShell`. |
| `client/src/pages/admin/work-logs/*` | Counter-log admin pages are reused inside supervisor routes. |
| `client/src/pages/admin/lane-rentals.tsx` | Lane rentals page is reused inside supervisor route. |
| `client/src/pages/courts/*` | Courts pages are shared by employee and supervisor frames. |
| `/api/admin/*` selected backend routes | Some existing clients still call these APIs; route ownership is handled by frontend shell and guards. |

## Delete Candidates After Replit Acceptance

Do not delete these until the equivalent module route has passed Replit acceptance and no imports remain.

| Candidate | Condition Before Delete |
|---|---|
| `client/src/components/app-sidebar.tsx` | No route or story imports it; no legacy page relies on it. |
| Unused legacy pages under `client/src/pages/analytics.tsx` and `client/src/pages/operations.tsx` | `/analytics` and `/operations` redirect only, and no workbench route imports these pages. |
| Legacy naked courts links | `rg 'href=.*"/courts|/courts/\\$' client/src` returns only redirect tests or comments. |
| Legacy admin UI-only routes | Supervisor module replacements exist under `client/src/modules/supervisor/*`. |

## Cleanup Gates

Run these before and after any legacy deletion:

```bash
npm run check:workbench-governance
npm run smoke:modules
npm run unit:modules
npm run dry-run
```

Manual checks:

- `/admin/parking/dashboard` redirects to `/supervisor/parking`.
- `/courts/xinbei` redirects to `/supervisor/courts/xinbei`.
- `/supervisor/parking`, `/supervisor/lane-rentals`, `/supervisor/counter-log/submissions`, and `/supervisor/courts/xinbei` still render in the supervisor shell.
- No user-facing sidebar turns white.

## Non-goals

- Do not remove compatibility redirects until operations confirms there are no external bookmarks.
- Do not rename backend API paths in the same pass as UI cleanup.
- Do not delete old page components while they still provide the implementation behind a workbench wrapper.
