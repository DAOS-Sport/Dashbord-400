# Module Execution Layer

Date: 2026-04-27
Status: Active baseline

## Purpose

This document binds three existing layers into one runtime contract:

- UIUX architecture: defines how people use the workbench
- technical architecture: defines data flow and ownership
- Module Registry: defines what modules exist

Target state:

- navigation is registry-driven
- dashboard/home cards are registry-driven + BFF-driven
- system health is registry-driven
- no module appears in UI unless it is registered

## Single Source Of Truth

`shared/modules` is the source of truth for:

- sidebar navigation
- dashboard/home card ownership
- BFF section ownership
- module lifecycle stage
- module health visibility
- permission and telemetry expectations

Forbidden:

- frontend hardcoded sidebar module existence
- frontend hardcoded dashboard module existence
- component-local fake fallback data for missing modules
- BFF responses that bypass registry ownership

## Runtime Flow

```txt
Module Registry -> /api/modules/navigation -> Sidebar / Bottom Nav
Module Registry -> /api/modules/health -> System Dashboard
Module Registry + BFF -> /api/bff/{role}/... -> Home/Dashboard Cards
```

## Employee Home Contract

Employee home must expose a stable execution-layer card contract under `homeCards`:

- `homeCards.todayTasks`
- `homeCards.announcements`
- `homeCards.handover`
- `homeCards.quickActions`
- `homeCards.shiftReminder`
- `homeCards.bookingSnapshot`

Legacy aliases may coexist during migration, but new UI work must prefer `homeCards`.

Current employee UI ordering:

- PC top bar + left sidebar are both used on employee pages.
- PC left sidebar is generated from `/api/modules/navigation` and must remain in this order: 首頁, 櫃台交接, 活動檔期/課程快訊, 常用文件, 個人工作記事, 相關問題詢問, 點名/報到.
- Mobile home order is: 今日任務, 快速操作最多 7 個, 群組重要公告, 櫃台交辦.
- `homeCards.handover.payload` is the home-card handover payload for 櫃台交辦.
- `homeCards.shiftReminder.payload` is the ShiftBoard DTO for 今日班表.
- 快速操作的預設入口必須由 `homeCards.quickActions` / `shortcuts` BFF section 提供；使用者自訂排序、顯示名稱、連結與色彩只能作為個人 UI preference，不可成為權限或 session truth。

Employee handover runtime APIs:

- `POST /api/handover`
- `GET /api/bff/employee/handover/summary`
- `GET /api/bff/employee/handover/list`
- `PATCH /api/handover/:id/read`
- `PATCH /api/handover/:id/reply`
- `PATCH /api/handover/:id/complete`
- `DELETE /api/handover/:id`

Employee activity periods:

- route: `/employee/activity-periods`
- source: existing employee home BFF `campaigns` section, backed by `employee_resources` and campaign candidates
- empty state: show no fake activities when the source has no rows

Employee shift runtime API:

- `GET /api/bff/employee/shifts/today`

## Lifecycle

Each module must stay in one of these stages:

- `planned`
- `ui-only`
- `api-wired`
- `bff-wired`
- `production-ready`
- `disabled`

Rules:

- `planned`: registered, not connected
- `ui-only`: page/UI exists, runtime contract incomplete
- `api-wired`: API exists, but no BFF/home execution path
- `bff-wired`: BFF exists, module may appear as `incomplete`
- `production-ready`: full runtime path is allowed

Homepage/dashboard implications:

- `planned`, `ui-only`, `api-wired`: must not appear as live home-layout cards
- `bff-wired`: may appear, but must render as `incomplete`
- `production-ready`: may render as `ready` or `empty`

## Rendering Rules

Navigation:

- source: `GET /api/modules/navigation`
- conditions:
  - `navVisible = true`
  - role matches
  - required permission passes

Home layout:

- source: `GET /api/modules/home-layout`
- used for registry-driven card ownership and order
- only includes `bff-wired` and `production-ready` modules

Home/dashboard data:

- source: `GET /api/bff/{role}/...`
- every returned card must map to a registered `moduleId`
- no fake data for unconnected modules

Health:

- source: `GET /api/modules/health`
- statuses:
  - `ready`
  - `degraded`
  - `not_connected`
  - `error`

## Enforcement

The following are execution-layer failures:

- module shown in UI without registry entry
- navigation hardcoded as module truth
- dashboard card built outside registry/BFF ownership
- fake data returned as if a module were connected
- module without telemetry expectation
- module without health visibility

## Development Order

Required order:

1. define module in registry
2. add API / BFF ownership
3. connect UI
4. add telemetry
5. add health
6. add tests / smoke checks

Forbidden order:

- UI first, registry later

## Current Repo Notes

- registry APIs already exist: `/api/modules/registry`, `/api/modules/navigation`, `/api/modules/home-layout`, `/api/modules/health`
- employee home now exposes `homeCards.*` as the stable execution-layer contract
- system dashboard must read `/api/modules/health` for module-health visibility
- smoke checks remain the minimum deploy gate

## Verification

```bash
npm run type-check
npm run build
npm run smoke:modules
```
