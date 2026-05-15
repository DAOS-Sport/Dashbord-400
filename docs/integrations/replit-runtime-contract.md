# Replit Runtime Contract

Last updated: 2026-05-15

This file is the deployment contract for running the CMS on Replit against the shared Neon database and external adapters.

## Runtime Port

Replit should expose one web port:

| Variable | Value | Purpose |
|---|---:|---|
| `PORT` | `5000` | Express serves API and static client on `0.0.0.0:5000`; `.replit` maps it to external port 80. |

The server must keep using `process.env.PORT`; do not hardcode another port in application code.

## Data Mode

These non-secret defaults are safe to keep in `.replit`:

| Variable | Value |
|---|---|
| `DATA_SOURCE_MODE` | `real` |
| `DATABASE_PROFILE` | `neon` |
| `REPLIT_DATA_ADAPTER_MODE` | `real` |
| `RAGIC_ADAPTER_MODE` | `real` |
| `SCHEDULE_ADAPTER_MODE` | `real` |
| `BOOKING_ADAPTER_MODE` | `mock` |
| `STORAGE_ADAPTER_MODE` | `mock` |

`BOOKING_ADAPTER_MODE` and `STORAGE_ADAPTER_MODE` remain mock until those provider contracts are finalized.

## Required Replit Secrets

Configure these in Replit Secrets, not in `.replit`:

| Secret | Required | Purpose |
|---|---|---|
| `NEON_DATABASE_URL` or `DATABASE_URL` | Yes | PostgreSQL / Neon connection string. The app hard-fails in real mode if neither exists. |
| `INTERNAL_API_TOKEN` | Recommended | Shared fallback token for internal service calls. |
| `REPLIT_DATA_API_TOKEN` | Optional | Token for a remote Replit projection provider when `REPLIT_DATA_BASE_URL` is used. |
| `LINE_BOT_ADMIN_TOKEN` | Optional | LINE announcement group admin reads. Missing token degrades announcement fetches. |
| `LINE_BOT_INTERNAL_TOKEN` | Optional | Internal LINE bot API calls; falls back to other internal tokens. |
| `SMART_SCHEDULE_API_TOKEN` | Optional | Smart schedule integration. |
| `RAGIC_API_KEY` | Optional | Ragic real adapter. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Optional | Legacy Gmail integration only. |

## External Endpoints

| Variable | Default | Purpose |
|---|---|---|
| `LINE_BOT_BASE_URL` | `https://line-bot-assistant-ronchen2.replit.app` | 400 LINE bot / announcement service. |
| `SMART_SCHEDULE_BASE_URL` | `https://smart-schedule-manager.replit.app` | Smart schedule service. |
| `REPLIT_DATA_BASE_URL` | empty | Optional projection-provider base URL. Leave empty when CMS reads Neon directly. |
| `EXTERNAL_API_TIMEOUT_MS` | `10000` | External adapter timeout. |

## Local / Replit Smoke Checks

Run before pushing a deployment build:

```bash
npm run dry-run
```

After Replit boots, check:

```bash
curl https://<replit-host>/api/modules/health
curl https://<replit-host>/api/bff/system/dashboard
```

Expected behavior:

- Without session cookies, protected role surfaces may return auth errors.
- Boot should not fail if optional provider tokens are missing; those providers should degrade in System / IT views.
- Boot should fail fast if `DATA_SOURCE_MODE=real` and no `NEON_DATABASE_URL` / `DATABASE_URL` is configured.

## Source Ownership

Runtime BFF entrypoints are intentionally split by role:

| Area | File |
|---|---|
| Registrar | `server/modules/bff/routes.ts` |
| Employee + lifeguard BFF routes | `server/modules/bff/employee-routes.ts` |
| Supervisor BFF routes | `server/modules/bff/supervisor-routes.ts` |
| System BFF routes | `server/modules/bff/system-routes.ts` |
| Shared BFF services | `server/modules/bff/services/*` |

Do not add new role-specific endpoints back into `server/modules/bff/routes.ts`; add them to the matching role route file.
