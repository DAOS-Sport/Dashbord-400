## Overview
This project develops an enterprise-grade dashboard for the 駿斯 LINE Bot system, functioning as a multi-page SaaS application. Its primary purpose is to provide comprehensive operational oversight and management capabilities across various aspects of the business. Key capabilities include real-time data visualization, analytics, cross-venue operations, HR auditing, system health monitoring, anomaly report management, and an Announcement Classifier module with a candidate review workflow. The business vision is to centralize management and improve efficiency for the LINE Bot system, offering a robust tool for data-driven decision-making and streamlined workflows.

## User Preferences
I prefer detailed explanations. I want iterative development. Ask before making major changes. I prefer clear and concise communication. My preferred coding style is functional programming where appropriate. Do not make changes to the `shared/schema.ts` file without explicit approval.

## System Architecture
The application is built with a React, Vite, and TypeScript frontend, utilizing Tailwind CSS and Shadcn UI for a Vercel-inspired design system. This includes an achromatic palette, `shadow-as-border` styling, and a `.vercel-card` utility class. Animations are handled by Framer Motion, charts by Recharts, and icons by Lucide React. Typography uses Geist Sans (body/UI) and Geist Mono (code/labels) with specific weight and letter-spacing preferences. Routing is managed by Wouter.

The backend uses Express with PostgreSQL and Drizzle ORM. Email notifications are sent via Nodemailer (Gmail SMTP), and file uploads are handled by Multer. Dark mode functionality is class-based and persisted locally.

The system is designed with a modular project structure, separating client-side components, pages, and hooks from server-side routes, storage, and database configurations. A significant part of the architecture focuses on handling various data sources, including live API data from several endpoints, and integrating with external services.

**Key Features and Implementations:**
- **Dashboard Layout**: Features a main dashboard with four blueprint sections displaying live API data, including global applications, private services, venue automation matrices, and architecture/dependency status.
- **Announcement Classifier Module**: Includes a candidate list with filters, a detail drawer, and an approve/reject workflow, along with an analytics dashboard for KPIs and trends.
- **Anomaly Report System**: Supports receiving reports via API, storing them in PostgreSQL, sending Gmail notifications, and managing them through a frontend interface with expandable cards and KPIs. Includes batch resolution and notification recipient management.
- **Employee Portal**: A separate UI/UX with a distinct color scheme (navy/teal/green Material Design 3 palette) and fonts (Manrope + Inter). It features Ragic login authentication, session management, and config-driven sections like SOPs, announcements, campaigns, and work logs.
- **Work-logs Module**: A comprehensive system for managing daily tasks, assigned tasks, recurring tasks, water quality records, and lifeguard handover notes, accessible through an aggregator and specific completion/submission endpoints. It also includes admin/supervisor CRUD functionalities. The admin module supports two parallel sub-modules — 救生員日誌 at `/admin/work-logs/*` and 櫃台日誌 at `/admin/counter-logs/*` — sharing the same React page components and database tables, segregated by a `moduleType` column ("lifeguard" / "counter") on `daily_task_templates`, `lifeguard_assigned_tasks`, `recurring_task_templates`, and `daily_report_submissions`. The counter sub-module hides the water-quality tabs.

**Design System Choices:**
- **UI/UX**: Vercel-inspired design with a focus on clean, modern aesthetics, achromatic colors, and subtle shadow-as-border effects.
- **Typography**: Specific font choices (Geist Sans, Geist Mono) and defined weights for different elements (body, UI, headings) with precise letter-spacing.
- **Iconography**: Exclusive use of SVG icons (Lucide React) to maintain visual consistency and avoid emojis in the UI.

## External Dependencies
- **Primary LINE Bot Assistant API**: `https://line-bot-assistant-ronchen2.replit.app`
  - Core endpoints for dashboard feature stats, task stats, attendance stats.
  - Extended endpoints for global apps, private services, venue automations, and service health.
  - Proxied Announcement endpoints for summary, candidates list, candidate details, approval/rejection, and weekly reports.
- **Proxied Smart Schedule API**: `https://smart-schedule-manager.replit.app`
  - Overview and interview user data.
- **PostgreSQL Database**: Used with Drizzle ORM for data persistence, including anomaly reports, users, and work-logs schema. (e.g., Neon serverless)
- **Gmail SMTP**: For sending email notifications via Nodemailer, requiring `GMAIL_USER` and `GMAIL_APP_PASSWORD` environment variables.
- **Ragic API**: For employee portal login authentication, requiring `RAGIC_API_KEY`, `RAGIC_ACCOUNT_PATH`, and `RAGIC_EMPLOYEE_SHEET` environment variables.

## 群組重要公告綁定 (announcement-groups)
- 主管端正式入口：`/supervisor/announcement-groups`；舊 `/admin/announcement-groups` 僅保留 redirect。
- 員工端：`/employee` 與 `/employee/announcements` 依 active facility 讀取已綁定 LINE 群組文字訊息。
- 後端模組：`server/modules/announcement-groups/`。
- Upstream：`LINE_BOT_BASE_URL` + `/api/admin/messages`。
- Auth：Bearer token 從 `LINE_BOT_ADMIN_TOKEN` env 讀取；未設定時 CRUD 可用、LINE 拉取降級顯示。
- Cache：30 秒 in-memory，依 groupId / hours / limit 查詢快取。
- Schema：`facility_announcement_groups`，主管可 CRUD 場館與 LINE groupId 綁定。
- 稽核：主管 CRUD/test-fetch 與員工公告預覽會寫入 `/system/audit`。

## Recent additions (Task #14)
- **松山國小水道租借管理** (`/admin/lane-rentals`): supervisor-only grid (5:30–22:00 × 5 lanes A–E), click-to-book with overlap prevention. Backend uses postgres advisory locks (hashtextextended) inside a transaction to atomically re-check and insert/update, eliminating TOCTOU on concurrent bookings. PATCH endpoint uses a strict zod whitelist that forbids editing facilityKey/bookingDate/laneCode/createdBy/createdByName, preventing cross-facility privilege escalation and audit-field tampering.
- **模組拓撲圖** (`/system/topology`): React Flow diagram driven by data-only `client/src/config/topology-config.ts`. Add nodes/edges in the config to surface them on the diagram — no UI code change required. Route is registered inside `WorkbenchRouter` (must be placed BEFORE the catch-all `/system` route).
- New table `lane_rentals` (drizzle); IStorage methods `listLaneRentals/getLaneRentalById/findLaneRentalConflicts/createLaneRental/updateLaneRental/deleteLaneRental`.

## 公告 Overlay（2026-05）
- 員工/主管端 `/employee/announcements` 直接顯示原文（不再有 detail page，detail route 已移除）。
- 任何登入者可：📌 置頂到指定時間（PIN_PRESETS 1h/4h/1d/3d/7d 或自訂 datetime）、📝 加備註（重複公告辨識）、🗑️ 隱藏。
- 只有主管（`grantedRoles` 含 supervisor 或 system）可：恢復顯示已隱藏公告（清單入口在公告頁右上「已隱藏公告」按鈕，呼叫 `GET /api/announcement-overlays/hidden`）。
- 後端模組：`server/modules/announcement-overlays/routes.ts`，5 endpoints（hide/unhide/pin/unpin/note）+ 1 supervisor-only listing。
- Schema：`announcement_overlays`（PK = BFF announcement id，例如 `line-{messageId}`、`portal-ann-{id}`、`employee-ann-{id}`），欄位 `is_hidden`、`pinned_until`、`note`、`last_modified_*`，2 個 index。
- BFF 整合：`applyAnnouncementOverlays()` helper 在 BFF 兩個 announcement assembly 處（live + degraded）合併 overlay；hidden 過濾、pinnedUntil > now 排序至最頂，並把 overlay 欄位掛到 `AnnouncementSummary` 上（`overlayPinnedUntil` / `overlayNote` / `overlayHidden` / `overlayLastModifiedByName` / `overlayLastModifiedAt`）。
- 稽核：所有 overlay 動作寫入 `audit` (`announcement-overlay.{action}`)；hide 在前端有 `confirm()` 二次確認。
- ID 驗證：route param 走正規式 `^[a-zA-Z0-9._:\-]+$`、長度 1–200。
- 員工首頁 AnnouncementCard 已移除 detail Link，改顯示 `overlayNote`（如有）。

## Phase-2 停車場電子簽約 (2026-05)
- New table cols on `parking_contracts`: `terms_version`, `sign_token_hash`, `sign_token_expires_at`, `signed_from_ip`, `signed_user_agent`, `signer_name`, `signer_id_last4`, `vehicle_reg_photo_url`, `driver_license_photo_url`, `id_card_photo_url`. All Phase-2 fields are omitted from `insertParkingContractSchema` so they can only be written via the dedicated sign endpoints.
- Backend (server/modules/parking/routes.ts):
  - `POST /api/parking/contracts/:id/issue-sign-link` (supervisor) → returns one-time `/parking/sign/:token` URL (token sha256-hashed in DB; 7-day expiry).
  - `GET /api/parking/sign-tokens/:token` (public) → resolves contract + vehicle + plan + terms snapshot.
  - `POST /api/parking/sign-tokens/:token/upload-url` (public, token-gated) → presigned PUT for Replit Object Storage.
  - `POST /api/parking/sign-tokens/:token/finalize` (public) → records signature + photos + IP/UA, advances contract status, burns the token (single-use).
  - `POST /api/parking/contracts/:id/sign` (supervisor, in-person mode) — extended to the same payload shape; gated by cookie auth instead of token.
- Terms text lives in `shared/parking-terms.ts` (`PARKING_TERMS_VERSION = "2026-NBHS-v1"`); the finalize endpoint rejects mismatched versions with HTTP 409.
- Frontend:
  - Shared `<ContractSigningView>` (`client/src/pages/parking/contract-signing-view.tsx`) — full T&C with scroll-to-bottom gate, "我已閱讀並同意" checkbox, three photo slots (行照/駕照 required, 身分證 optional), hand-rolled pointer-events canvas signature pad (no signature_pad package).
  - Public mobile route `/parking/sign/:token` mounted in `App.tsx` BEFORE the workbench shell branch (no sidebar, no auth).
  - Admin contracts page: 詳情 drawer now shows signed photos + signature, plus "開啟簽約（現場）" (in-person tablet flow inside a Dialog) and "產生簽約連結" (copy-to-clipboard sharing dialog).
- Object Storage: Replit blueprint installed (bucket `repl-default-bucket-…`). `registerObjectStorageRoutes` mounted in `server/routes.ts`; `/objects/(.+)` route uses a regex (path-to-regexp v8 no longer accepts `:objectPath(*)`).

## 場地預約模組（courts）

- 兩所學校：新北高中（`xinbei`，14 個場地）、三重商工（`sanchong`，3 個場地）。
- 共用設定：`shared/court-config.ts`（school/court 列表、解析正規式）。
- 後端：`server/modules/courts/{routes,storage,google-calendar}.ts`，掛載於 `/api/courts/:school/...`，全部端點走 `requireEmployee()`（員工＋主管皆可讀寫）。Google Calendar 同步在缺少 `GOOGLE_REFRESH_TOKEN` 時 no-op。
- 資料表：`court_reservations`、`court_sync_logs`、`court_sync_errors`（school 欄位區分學校）。
- 前端：`client/src/pages/courts/{calendar,week,month,search,admin}.tsx`、共用元件於 `_components/`、`@/lib/court-{school,utils,date-utils}`。路由分主管/員工兩套：`/supervisor/courts/:school[/(week|month|search|admin)]`（包 `SupervisorCourtsFrame`）、`/employee/courts/:school[/(week|month|search|admin)]`（包 `EmployeeCourtsFrame`）。`/courts/:school[/...]` 為 legacy alias，自動 redirect 到 supervisor 版。Sidebar「場地預約」分組指向主管路由；員工 nav 透過 `getWorkbenchRoutes("employee")` 自動帶入 `/employee/courts/xinbei`。
- 拓撲：`courts-xinbei`、`courts-sanchong` 節點與 PostgreSQL、Google Calendar 邊在 `topology-config.ts`。
