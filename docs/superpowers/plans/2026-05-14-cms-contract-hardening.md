# CMS Contract Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the CMS front-end panels and module contract back to a trustworthy baseline for employee, supervisor, and IT roles.

**Architecture:** Keep the existing modular-monolith and BFF architecture. Fix the contract sources first, then fix UI states so users see actionable CMS states instead of implementation details or stale placeholder signals.

**Tech Stack:** React, TypeScript, Wouter, TanStack Query, shared module registry, Express BFF, Playwright browser checks.

---

### Task 1: Restore Module Contract Gates

**Files:**
- Modify: `client/src/config/topology-config.ts`
- Verify: `scripts/module-smoke.ts`

- [ ] **Step 1: Replace split courts topology nodes with canonical `courts`**

Edit `topologyNodes` so the topology uses one `courts` node with path `/supervisor/courts/xinbei`.

- [ ] **Step 2: Replace split courts topology edges**

Edit `topologyEdges` so only `courts -> postgres` and `courts -> google-calendar` remain.

- [ ] **Step 3: Run smoke contract**

Run: `npm run smoke:modules`
Expected: no `courts-xinbei` or `courts-sanchong` failure.

### Task 2: Fix Employee Homepage Work Surface

**Files:**
- Modify: `client/src/modules/employee/home/employee-home-page.tsx`
- Verify: `scripts/module-unit-tests.ts`

- [ ] **Step 1: Make the courts preview match the fixed slot contract**

Ensure the courts preview renders only when `homeSlots.isEnabled("courts") && courtSchools.length` and keeps `lg:col-span-8`.

- [ ] **Step 2: Remove main-dashboard placeholder modules that are not actionable**

Remove the `TodayTutoringCard` block from the employee home grid until a real data source exists.

- [ ] **Step 3: Hide technical announcement source errors from employee UI**

Map `LINE_BOT_ADMIN_TOKEN 未設定` and related unavailable announcement reasons to employee-facing copy.

- [ ] **Step 4: Run module unit tests**

Run: `npm run unit:modules`
Expected: employee home slot and courts preview assertions pass.

### Task 3: Fix System and Role Shell Trust Signals

**Files:**
- Modify: `client/src/modules/system/control-center/page.tsx`
- Modify: `client/src/modules/workbench/role-shell.tsx`

- [ ] **Step 1: Stop showing normal KPI values when system control-center data fails**

When `controlCenterQuery.isError`, show the failure message before KPI cards and do not render zero-valued KPI cards as if the system is healthy.

- [ ] **Step 2: Fix system/supervisor shell copy**

Use system-specific sidebar text and footer identity when `role === "system"`; keep supervisor wording only for supervisor.

- [ ] **Step 3: Replace hard-coded shell date**

Render today's local date in `zh-TW` format instead of `2026/04/23`.

- [ ] **Step 4: Verify type checking**

Run: `npm run check`
Expected: TypeScript passes.

### Task 4: End-to-End Verification

**Files:**
- Verify: `package.json` scripts
- Verify: browser routes `/employee`, `/supervisor`, `/system`, `/system/watchdog`

- [ ] **Step 1: Run full local contract gate**

Run: `npm run dry-run`
Expected: type-check, check:modules, smoke:modules, unit:modules, check:workbench-governance all pass.

- [ ] **Step 2: Run focused module checks**

Run: `npm run check:modules`
Run: `npm run check:workbench-governance`
Expected: both pass.

- [ ] **Step 3: Browser-check the role surfaces**

Open `/employee`, `/supervisor`, `/system`, and `/system/watchdog`.
Expected: no blank screen, system page does not present failed data as healthy, employee page does not expose `LINE_BOT_ADMIN_TOKEN`.

- [ ] **Step 4: Commit**

Run:
```bash
git add client/src/config/topology-config.ts client/src/modules/employee/home/employee-home-page.tsx client/src/modules/system/control-center/page.tsx client/src/modules/workbench/role-shell.tsx docs/superpowers/plans/2026-05-14-cms-contract-hardening.md
git commit -m "fix: harden cms role surfaces and contracts"
```
