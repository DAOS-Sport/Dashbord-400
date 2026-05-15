# 400 小幫手 IT 治理模組 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CMS SYSTEM-side governance surface for 400 LINE helper monitoring and caution-query permission control.

**Architecture:** CMS owns caution-query permissions and audit trail in Postgres. 400 LINE helper checks CMS through internal-token endpoints. The existing System control center links into a 400 helper status page with six submodules and a dedicated whitelist/caution permission management page.

**Tech Stack:** React + Wouter + TanStack Query, Express routes, Drizzle schema, Postgres migrations, existing RoleShell/System registry.

---

### Task 1: Navigation Annotation
**Files:**
- Modify: `client/src/modules/workbench/role-shell.tsx`

- [ ] Mark System nav entries `helper-status` and `line-whitelist` with a small colored `400監聽` note so IT users know those entries monitor 400 小幫手.
- [ ] Keep the active row styling intact.
- [ ] Verify with `npm run check`.

### Task 2: Caution Permission Schema and APIs
**Files:**
- Modify: `shared/schema.ts`
- Create: `migrations/0012_caution_query_permissions.sql`
- Modify: `server/modules/system/routes.ts`

- [ ] Add `caution_query_permissions` and `caution_query_permission_audit` tables.
- [ ] Add SYSTEM session APIs for list/create/period/status/audit.
- [ ] Add internal-token check and usage-log APIs for 400 LINE helper.
- [ ] Return `schema_pending` instead of crashing if migration is not applied.

### Task 3: Caution Permission UI
**Files:**
- Modify: `client/src/modules/system/line-whitelist/api.ts`
- Modify: `client/src/modules/system/line-whitelist/page.tsx`

- [ ] Replace the generic feature whitelist primary UI with the spec's 慎用查詢權限管理.
- [ ] Add Ragic-backed candidate search, period setting, active/disabled switch, history drawer, and status chips.
- [ ] Keep other whitelist tabs visible as future proxy tabs.

### Task 4: 400 Helper Status Six Modules
**Files:**
- Modify: `client/src/modules/system/helper-status/page.tsx`
- Modify: `client/src/App.tsx`
- Modify registry/nav descriptors as needed.

- [ ] Add `/system/lineXBS-status` alias.
- [ ] Add left-side subnav: 總覽控制台, 對外服務, 端點與 Secrets, 即時追蹤, 推送狀態, 白名單管理.
- [ ] Keep current helper service data but render it inside the six-module structure.

### Task 5: Registry, Tests, Docs
**Files:**
- Modify: `shared/modules/*`, `shared/navigation/workbench-routes.ts`, `scripts/module-smoke.ts`, `scripts/module-unit-tests.ts`
- Regenerate: `docs/governance/module-governance.md`

- [ ] Ensure module registry includes both 400 helper status and caution whitelist.
- [ ] Run `npm run docs:module-governance`.
- [ ] Run `npm run dry-run`.
