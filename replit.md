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

## 公告 Widget 分流 + DB 留存（Task #19）

- **Widget A（重要公告）**：從 LINE Bot API 拉取 `candidateType IN ('rule','notice','script')` 的候選公告，在員工首頁 `AnnouncementCard` 顯示，`sourceLabel` 標示「AI分類」。
- **Widget B（課程活動）**：從 LINE Bot API 拉取 `candidateType IN ('campaign','discount')` 的候選公告，合併進員工首頁 `CompactEventsCard`（`campaigns` section），`statusLabel` 顯示「進行中」/「即將開始」。
- **分流邏輯**：`server/modules/announcements/widget-service.ts`，30 秒 in-memory cache 每 facilityKey，背景 upsert 至本地 DB（fire-and-forget，`onConflictDoUpdate` by `content_hash`）。
- **REST 端點**：`GET /api/widgets/announcements/important` 和 `/campaigns`，走 `requireSession` 認證，query params `facility`, `limit`（上限 20）。
- **BFF 整合**：`employee-home-enrichment-service.ts` 並行抓取兩組候選，Widget A 合併進 `announcementsBeforeOverlay`，Widget B 合併進 `campaigns`。
- **DB Schema**：`announcement_candidates` 新增 5 個 nullable 欄位：`scope_type`, `applies_to_roles`, `start_at`, `end_at`, `facility`。
- **品質過濾**：`status IN (approved/published/active)` + `confidence >= 0.6` + 非 `ignore` 類型 + `end_at` 未過期；Widget B 額外過濾 14 天內開始的活動。

## 場地預約模組（courts）

- 兩所學校：新北高中（`xinbei`，14 個場地）、三重商工（`sanchong`，3 個場地）。
- 共用設定：`shared/court-config.ts`（school/court 列表、解析正規式）。
- 後端：`server/modules/courts/{routes,storage,google-calendar}.ts`，掛載於 `/api/courts/:school/...`，全部端點走 `requireEmployee()`（員工＋主管皆可讀寫）。Google Calendar 同步在缺少 `GOOGLE_REFRESH_TOKEN` 時 no-op。
- 資料表：`court_reservations`、`court_sync_logs`、`court_sync_errors`（school 欄位區分學校）。
- 前端：`client/src/pages/courts/{calendar,week,month,search,admin}.tsx`、共用元件於 `_components/`、`@/lib/court-{school,utils,date-utils}`。路由分主管/員工兩套：`/supervisor/courts/:school[/(week|month|search|admin)]`（包 `SupervisorCourtsFrame`）、`/employee/courts/:school[/(week|month|search|admin)]`（包 `EmployeeCourtsFrame`）。`/courts/:school[/...]` 為 legacy alias，自動 redirect 到 supervisor 版。Sidebar「場地預約」分組指向主管路由；員工 nav 透過 `getWorkbenchRoutes("employee")` 自動帶入 `/employee/courts/xinbei`。
- 拓撲：`courts-xinbei`、`courts-sanchong` 節點與 PostgreSQL、Google Calendar 邊在 `topology-config.ts`。

## Task #26 – 模組健康 BFF 接線（2026-05）

### 模組 Registry（`shared/modules/registry/`）規則 — 勿亂改

每個 registry 物件有 `bff` 欄位，決定模組在 System Control Center 的狀態徽章：

| `bff` 欄位包含 | `status` 欄位 | 結果 |
|---|---|---|
| `*SectionKey`（任一）或 `apis` 有 `kind:"bff"` | `partial` / `implemented` | 顯示 `bff-wired`（綠色） |
| 無 `*SectionKey` | 任何 | 顯示 `not_connected`（灰色） |
| 有 `*SectionKey` | `planned` | 強制顯示 `planned`（灰色，overrides bff binding） |

**有效的 `*SectionKey` 欄位名稱**：`employeeSectionKey`、`supervisorSectionKey`、`systemSectionKey`。  
**注意**：bff 物件內不能有不存在的屬性名稱（會被 TS 型別擋住）。加 section key 前先看 `shared/modules/descriptors.ts` 的 `BffBinding` type。

### 已修正的模組清單（Task #26）

以下模組已新增對應 `*SectionKey`，使其從 `not_connected` 升為 `bff-wired`：

**foundation.ts**
- `auth` → `systemSectionKey: "auth"`

**governance.ts**
- `legacy-users` → `systemSectionKey: "legacyUsers"`
- `facilities` → `systemSectionKey: "facilities"`
- `session-governance` → `systemSectionKey: "sessionGovernance"`
- `user-role-snapshots` → `systemSectionKey: "userRoleSnapshots"`
- `bff-projections` → `telemetry.eventTypes` 補齊（已有 3 個 sectionKeys）

**operations.ts**
- `operations`（legacy）→ `supervisorSectionKey: "legacyOperations"`
- `courts` → 新增 `employeeSectionKey: "courts"`（原已有 `supervisorSectionKey`）

**content.ts**
- `notification-recipients` → `systemSectionKey: "notificationRecipients"`
- `notification-center` → status `planned` → **`partial`**（已有 `employeeSectionKey`）
- `registration-courses` → status `planned` → **`partial`**；`data` 改指向 `registration_courses` 新表；`apis` 補充 module-health BFF 端點
- `booking-snapshot` → status `planned` → **`partial`**（已有 `employeeSectionKey`）

**portal-integrations.ts**
- `portal-manage` → `supervisorSectionKey: "portalManage"`
- `gmail-integration` → `systemSectionKey: "gmailIntegration"`
- `file-upload-export` → `systemSectionKey: "fileUploadExport"`

### 新增 DB 表（Task #26，已 approved）

三張 stub 表已加入 `shared/schema.ts` 並推送至 DB：

| 表名 | 用途 |
|---|---|
| `notification_hub` | Notification Center 未來事件佇列 stub |
| `registration_courses` | 報名/課程模組 stub（含 facilityKey、starts_at、ends_at、capacity、status） |
| `booking_snapshots` | Booking Snapshot 日期佔位快照（含 facilityKey、snapshot_date、total/booked slots） |

### Module Health BFF 端點

- **檔案**：`server/modules/system/module-health-routes.ts`
- **掛載**：`registerModuleHealthRoutes(app, container)` 在 `server/modules/system/routes.ts` 的 `registerSystemRoutes` 內呼叫（在 `registerLinebotManagementRoutes` 之後）
- **端點**：`GET /api/bff/system/module-health/:moduleId`（需 `requireSession` + `requireRole("system")`）
- 目前支援的 moduleId：`notification-center`、`registration-courses`、`booking-snapshot`
- 回傳 `{ moduleId, status, rowCount, tableExists, checkedAt }` 格式

### linebot-management-routes.ts 修正

`fetchContractFullStatus`（約 line 251）：當 `result.data.overall === "failing"` 時，`status` 改回傳 `"degraded"`（黃色）而非 `"not_connected"`。同時 `note` 顯示「400LINE 自報降級，連線通訊正常」，避免誤判為斷線。
