# LINE Bot 系統全局藍圖 (System Blueprint)

## Overview
Enterprise-grade dashboard for the 駿斯 LINE Bot system. Multi-page SaaS application with 8 views: main dashboard with live API data, analytics, cross-venue operations, HR audit, system health monitoring, anomaly report management, and a 2-page Announcement Classifier module (公告歸納器) with candidate review workflow.

## Tech Stack
- **Frontend**: React, Vite, TypeScript
- **Styling**: Tailwind CSS, Shadcn UI with Vercel-inspired design system (DESIGN.md)
- **Design System**: Vercel style — shadow-as-border (`0px 0px 0px 1px rgba(0,0,0,0.08)`), achromatic palette, `.vercel-card` utility class
- **Animation**: Framer Motion
- **Charts**: Recharts (used in Analytics page)
- **Icons**: Lucide React (no emoji in UI — SVG icons only)
- **Font**: Geist Sans (body/UI) + Geist Mono (code/labels) — loaded from Google Fonts, OpenType `"liga"` enabled
- **Typography**: Weight 400 (body), 500 (UI/interactive), 600 (headings); negative letter-spacing at display sizes (-0.04em display, -0.02em heading)
- **Routing**: Wouter (8 routes)
- **Backend**: Express + PostgreSQL (Drizzle ORM)
- **Email**: Nodemailer (Gmail SMTP with app password)
- **File Upload**: Multer (for anomaly report images)
- **Dark Mode**: Class-based toggle via sidebar footer, persisted to localStorage

## Project Structure
- `client/src/App.tsx` - App root with sidebar layout, routing (8 routes), dynamic header title (no emoji)
- `client/src/components/app-sidebar.tsx` - Sidebar with SVG icons, dark mode toggle (ThemeToggle), active state via `useLocation`
- `client/src/pages/dashboard.tsx` - Main dashboard with 4 blueprint sections (live API data)
- `client/src/pages/analytics.tsx` - Analytics with KPIs, venue task ranking (live API); interaction chart shows empty state until API connected
- `client/src/pages/operations.tsx` - Cross-venue resource monitoring (live API from venue-automations), shows venue features & schedules
- `client/src/pages/hr-audit.tsx` - HR audit with search bar, calls POST /api/hr-audit (returns 503 until API connected)
- `client/src/pages/system-health.tsx` - Real-time API health check (pings 11 endpoints every 60s), shows HTTP status & latency
- `client/src/pages/anomaly-reports.tsx` - Anomaly report management with expandable cards (live DB data)
- `client/src/pages/announcements.tsx` - Announcement candidate list with filters, detail drawer, approve/reject workflow. Normalizes API response (`items` → `candidates`, string confidence → number, `ignored` status support)
- `client/src/pages/announcement-summary.tsx` - Announcement analytics dashboard (KPIs, 7-day trends, type/facility distribution)
- `client/src/types/announcement.ts` - TypeScript types for announcement module
- `server/routes.ts` - API routes for anomaly reports, proxy endpoints for admin, and 6 announcement proxy endpoints
- `server/storage.ts` - DatabaseStorage using Drizzle ORM with PostgreSQL
- `server/db.ts` - Drizzle database connection (Neon serverless)
- `shared/schema.ts` - Drizzle schema (users, anomalyReports tables)

## External APIs
### Primary (Base: `https://line-bot-assistant-ronchen2.replit.app`)
#### Core (required — `strictFetch`, errors shown to user):
1. `GET /api/admin/dashboard/feature-stats` → groups[], featurePenetration[], totalGroups
2. `GET /api/admin/tasks/stats` → total, completed, pending, completionRate (string "64.9%"), byGroup
3. `GET /api/admin/attendance/stats` → todayCheckins, successful, failed, uniqueCheckers

#### Extended (optional — `safeFetch`, graceful null fallback):
4. `GET /api/admin/dashboard/global-apps` → tasks, gps, coach, survey status/stats
5. `GET /api/admin/dashboard/private-services` → general, management data
6. `GET /api/admin/dashboard/venue-automations` → venues[] with features/schedules
7. `GET /api/admin/dashboard/services-health` → service health statuses
8. `GET /api/admin/tasks/history/${groupId}` → HistoryTask[]

### Proxied Smart Schedule (Base: `https://smart-schedule-manager.replit.app`, via server/routes.ts):
9. `GET /api/admin/overview` → Proxied schedule manager overview
10. `GET /api/admin/interview-users` → Proxied interview/authorized users

### Proxied Announcement (Base: `https://line-bot-assistant-ronchen2.replit.app`, via server/routes.ts):
11. `GET /api/announcement-dashboard/summary` → Today's KPI stats (totalMessagesToday, analyzedMessagesToday, pendingReviewCount, approvedCount, rejectedCount, byType, byFacility)
12. `GET /api/announcement-candidates` → Paginated candidate list (supports status/candidateType/facilityName/groupId/dateFrom/dateTo/keyword/page/pageSize)
13. `GET /api/announcement-candidates/:id` → Single candidate detail + review history
14. `POST /api/announcement-candidates/:id/approve` → Approve candidate (body: { comment? })
15. `POST /api/announcement-candidates/:id/reject` → Reject candidate (body: { comment? })
16. `GET /api/announcement-reports/weekly` → 7-day trend report (days[] with totalMessages/analyzedMessages/candidatesCreated/approved/rejected/highConfidenceCount)

## Data Model
- **STRICT RULE**: No mock/fake/hardcoded data anywhere. All data must come from real APIs or show empty state.
- Feature keys from API are Chinese with emoji prefixes (e.g., "任務管理", "竹科天氣預報")
- `VENUE_FEATURES` array: 10 feature specs with label, instruction, apiKeys mapping, icon, colors (no emoji field)
  - `API_FEATURE_KEYWORDS` maps API feature names to frontend spec labels via keyword matching
  - Current feature mapping excludes the previously deferred pool-measurement prototype; do not add local routes or widgets for it in this workbench.
- Venue names: prefer `group.venue` from API, fallback to `VENUE_NAME_MAP` for groupId→display name
- `completionRate` from tasks API is a string like "64.9%" — parsed via `parseRate()`
- Non-feature keys excluded via `EXCLUDED_KEYS`: name, groupId, totalEnabled

## Anomaly Report System
- **POST /api/anomaly-report** — Receives anomaly reports from external clock-in system (JSON or multipart/form-data with images)
  - Stores report in PostgreSQL
  - Sends Gmail notification via nodemailer (GMAIL_USER + GMAIL_APP_PASSWORD env vars)
  - Supports up to 5 image attachments (10MB each), stored in `/uploads/anomaly-reports/`
  - Returns: { id, reportText, createdAt, imageUrls, lineUrl }
- **GET /api/anomaly-reports** — Returns all reports sorted by createdAt desc
- **GET /api/anomaly-reports/:id** — Returns single report or 404
- **Frontend page** (`/anomaly-reports`): Expandable card list with KPI summary, auto-refresh every 30s
  - KPIs: 總異常數, 今日異常, 最常見場館, 最常見原因
  - Each card expands to show: employee info, clock details, distance, fail reason, error msg, user note, images, full report text

## Routing (8 Pages)
| Route | Page | Data Source |
|-------|------|-------------|
| `/` | 營運戰情總覽 (Dashboard) | Live API (7+ endpoints) |
| `/analytics` | 決策與數據洞察 | Live API (tasks/stats) |
| `/operations` | 跨館資源監控 | Live API (venue-automations) |
| `/hr-audit` | HR 與權限稽核 | POST /api/hr-audit (503 until connected) |
| `/system-health` | 微服務健康監控 | Real-time health pings (11 endpoints) |
| `/anomaly-reports` | 打卡異常管理 | Live PostgreSQL data + Gmail notification |
| `/announcements` | 公告審核中心 | Live API (candidates list, approve/reject) |
| `/announcements/summary` | 公告分析總覽 | Live API (summary KPIs, weekly trends) |

## Dashboard Layout (4 Sections)
1. **全域通用與網頁應用**: 4 cards with live stats, LIFF badges on GPS/教練/客戶調查, usage guide text blocks
2. **私人專屬與權限對話**: Split panels (general/admin) with trigger command guides
3. **實體場館自動化矩陣**: Only enabled features shown (filtered), 10-feature CSS Grid, instruction line per badge. Each feature badge is clickable and opens a **FeatureDetailDrawer** with content based on the feature type:
   - 交辦任務/處理事項查詢/任務完成 → TaskSwimlaneContent (dual-column Kanban with real API data)
   - 天氣預報/風力預報 → WeatherPanel (empty state — awaiting weather API)
   - Deferred pool-measurement prototype is excluded from current Employee Home module work.
   - GPT小助理 → GptChatPanel (ChatGPT-style conversation preview)
   - Others → GenericFeaturePanel ("建置中" placeholder)
4. **架構與依賴關係**: Microservices with health status from API or empty state

## Sidebar Navigation (3 groups)
### 營運管理
- 營運戰情總覽 → / (LayoutDashboard icon)
- 打卡異常管理 → /anomaly-reports (AlertTriangle icon)
- 決策與數據洞察 → /analytics (TrendingUp icon)
- 跨館資源監控 → /operations (Building2 icon)
### 公告歸納
- 公告審核中心 → /announcements (FileText icon)
- 公告分析總覽 → /announcements/summary (BarChart3 icon)
### 系統管理
- HR 與權限稽核 → /hr-audit (ShieldCheck icon)
- 微服務健康監控 → /system-health (Activity icon)

## Anomaly Reports API
- `POST /api/anomaly-report` — JSON or multipart/form-data (data + images fields)
- `GET /api/anomaly-reports` — all reports descending by time
- `GET /api/anomaly-reports/:id` — single report
- `PATCH /api/anomaly-reports/:id/resolution` — update single resolution
- `PATCH /api/anomaly-reports/batch/resolution` — batch update resolution (ids[], resolution, resolvedNote)
- Frontend: search by name/code/venue, filter by venue dropdown, filter by status (pending/resolved), batch select + batch resolve/unresolve

## Notification Recipients System
- **Table**: `notification_recipients` (id, email, label, enabled, notifyNewReport, notifyResolution, createdAt)
- **API Routes**:
  - `GET /api/notification-recipients` — list all recipients
  - `POST /api/notification-recipients` — add recipient (email required)
  - `PATCH /api/notification-recipients/:id` — toggle fields (enabled, notifyNewReport, notifyResolution)
  - `DELETE /api/notification-recipients/:id` — remove recipient
- **Frontend**: Collapsible notification settings panel in anomaly reports page
  - Add/remove recipients with email + optional label
  - Toggle per-recipient: enabled, notify on new anomaly, notify on resolution change
  - Gmail sends to all enabled recipients matching event type (newReport or resolution)
- **Email fallback**: When no recipients are configured, system auto-sends to GMAIL_USER as default recipient
- **Test email**: `POST /api/test-email` — sends a test email to verify Gmail configuration works

## Announcement Candidates Export
- **`GET /api/announcement-candidates/export/all`** — Fetches all candidates from upstream API (up to 1000) and writes to `exports/announcement-candidates-export.json`
  - Returns: `{ success, message, filePath, exportedAt, totalCount }`
  - Each candidate includes: id, status, candidateType, title, summary, originalText, confidence, reasoningTags, recommendedAction, recommendedReply, badExample, appliesToRoles, scopeType, facilityName, groupId, displayName, userId, isFromSupervisor, startAt, endAt, detectedAt, sourceMessageId, extractedJson
- **`GET /exports/announcement-candidates-export.json`** — Serves the latest exported JSON file directly
- File is stored at `exports/announcement-candidates-export.json` and updated each time the export endpoint is called

## Employee Portal (員工值班入口)
- **Routes**: `/portal/login` (login page), `/portal/:facilityKey` (facility home)
- **Design**: Separate from admin — navy/teal/green Material Design 3 palette, Manrope + Inter fonts
- **Colors**: primary `#001d42`, secondary `#006b60`, accent `#1CB4A3`, green `#8DC63F`, bg `#f7f9fb`
- **Auth**: Ragic login — employee number as username, phone as password, proxied via `POST /api/auth/ragic-login`
- **Session**: localStorage (`portalAuth` for user, `facilityKey` for facility binding)
- **Layout**: Fixed dark navy top bar, dark navy sidebar (rounded-r-3xl), bento grid (12-col, 8+4), mobile bottom nav
- **Facilities**: 4 configs — `xinbei_pool`, `salu_counter`, `songshan_pool`, `sanmin_pool`
- **Sections**: Must-read SOP, group announcements, campaigns, handover, on-duty staff, contacts, rental (config-driven)
- **Data**: Announcements filtered by `status=approved` + `facilityName`; priority derived from confidence + candidateType + VIP tags
- **Files**:
  - `client/src/types/portal.ts` — Portal TypeScript types
  - `client/src/config/facility-configs.ts` — Facility configurations
  - `client/src/hooks/use-bound-facility.ts` — useBoundFacility + usePortalAuth hooks
  - `client/src/pages/portal/portal-login.tsx` — Login page
  - `client/src/pages/portal/portal-layout.tsx` — Layout with sidebar/topbar/bottom nav
  - `client/src/pages/portal/portal-home.tsx` — Home page with config-driven sections

## Environment Variables
- `GMAIL_USER` — Gmail address for anomaly notifications (daos.ragic.system@gmail.com)
- `GMAIL_APP_PASSWORD` — Gmail app password for SMTP auth
- `DATABASE_URL` — PostgreSQL connection string (Neon serverless)
- `RAGIC_API_KEY` — Ragic API key for employee login authentication
- `RAGIC_ACCOUNT_PATH` — Ragic account path (default: "daos")
- `RAGIC_EMPLOYEE_SHEET` — Ragic employee sheet path (default: "/default/1") — field mapping: 1000=員工編號, 1001=手機號碼, 1002=姓名, 1003=職位, 1004=場館
