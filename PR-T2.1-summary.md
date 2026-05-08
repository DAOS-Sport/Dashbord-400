# PR-T2.1: Supervisor Layout Refactor

## Files Changed

- `client/src/App.tsx` — added URL-driven workbench role detection, granted-role route guard, and active-role synchronization from the current route.
- `client/src/modules/workbench/role-switcher.tsx` — role tabs now navigate to role home routes instead of directly mutating activeRole.

## Behavior

- `/employee/*` requires employee/supervisor/system grant.
- `/supervisor/*` requires supervisor or system grant.
- `/system/*` requires system grant.
- Active role is still synchronized with `/api/auth/active-role` after route entry when the target role is part of `grantedRoles`, keeping existing BFF behavior compatible.

## Verification

- type-check: pass
- check: pass
- smoke:modules: pass
- check:modules: pass
- build: pass
- browser: `/supervisor`, `/system`, `/employee` all rendered for the current all-role session.

## Notes

- This does not remove the activeRole endpoint. It changes UI role tabs from "role mutation first" to "route navigation first".
- Backend `requireRole` middleware is unchanged.
- Build still emits pre-existing warnings for Browserslist age, PostCSS `from`, and large chunk size; no new build failure.
