# ADR 0001: Module Registry And BFF Contract

Date: 2026-04-27

## Status

Accepted

## Context

The workbench had many generated pages and cards, but ownership was spread across sidebar arrays, page code, legacy routes, BFF fallbacks, and DB tables. That made it easy to add UI shells without stable DTOs, role policy, telemetry, or test coverage.

Dreams CMS direction is Modular Monolith + BFF + Audit/Observability. The current repository should be cleaned incrementally instead of rewritten.

## Decision

Use `shared/modules` as the source of module ownership.

Expose runtime module contracts through:

- `/api/modules/registry`
- `/api/modules/navigation`
- `/api/modules/home-layout`
- `/api/modules/health`

Employee home must be BFF-driven and include stable `HomeCardDto` fields. Unconnected modules must return `not_connected` and a source status instead of fake data.

Authorization is backend-owned. Frontend reads `/api/auth/me` and must not treat localStorage as role, facility, token, or session truth.

Telemetry is non-blocking and uses platform endpoints only.

## Consequences

Positive:

- Sidebar and home-card composition can be checked by smoke scripts.
- Planned modules become visible as `not_connected` instead of hidden fake data.
- Future module work has a fixed registration/update path.

Tradeoffs:

- Legacy section DTOs and new home-card DTOs coexist during migration.
- Module settings persistence is not active until `module_settings` storage is connected.
- Some generated pages remain UI-first but are now visible in the completion matrix.

## Verification

Required before deploy:

```bash
npm run type-check
npm run build
npm run smoke:modules
```
