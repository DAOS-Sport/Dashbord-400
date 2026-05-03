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
## Recent additions (Task #14)
- **松山國小水道租借管理** (`/admin/lane-rentals`): supervisor-only grid (5:30–22:00 × 5 lanes A–E), click-to-book with overlap prevention. Backend uses postgres advisory locks (hashtextextended) inside a transaction to atomically re-check and insert/update, eliminating TOCTOU on concurrent bookings. PATCH endpoint uses a strict zod whitelist that forbids editing facilityKey/bookingDate/laneCode/createdBy/createdByName, preventing cross-facility privilege escalation and audit-field tampering.
- **模組拓撲圖** (`/system/topology`): React Flow diagram driven by data-only `client/src/config/topology-config.ts`. Add nodes/edges in the config to surface them on the diagram — no UI code change required. Route is registered inside `WorkbenchRouter` (must be placed BEFORE the catch-all `/system` route).
- New table `lane_rentals` (drizzle); IStorage methods `listLaneRentals/getLaneRentalById/findLaneRentalConflicts/createLaneRental/updateLaneRental/deleteLaneRental`.
