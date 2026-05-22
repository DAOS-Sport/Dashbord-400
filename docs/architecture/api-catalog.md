# API Catalog

## Canonical Sources

| Layer | File / endpoint | Purpose |
| --- | --- | --- |
| Express registration | `server/modules/api-hub/index.ts` | Single API router entry; registers every server route module in deterministic order. |
| Full route manifest | `server/modules/api-hub/route-manifest.ts` | Complete API inventory used by the system catalog. |
| Module registry | `shared/modules/registry.ts` | Module ownership, visible roles, route bindings, API bindings, data sources, integrations, and governance notes. |
| System BFF catalog | `GET /api/bff/system/api-catalog` | Runtime JSON catalog combining all route manifest entries with module/data-source classifications. |
| System UI | `/system/api-catalog` | Maintainer-facing table with project, feature, role, module, data source, handler, and filters. |

## Current Classification

Generated from `buildSystemApiCatalog()` after the catalog wiring.

| Metric | Count |
| --- | ---: |
| API routes | 304 |
| registered modules | 74 |
| unmapped APIs | 0 |
| inferred module matches | 108 |

## Project Groups

| Project | API count |
| --- | ---: |
| 400CMS | 193 |
| 400LINE | 42 |
| Portal | 29 |
| Legacy | 28 |
| Schedule | 7 |
| ObjectStorage | 3 |
| CollabCourse | 1 |
| External | 1 |

## Maintenance Rule

When adding or moving an API:

1. Register the Express handler through `registerApiHub` or a module already called by it.
2. Add or update the route in `server/modules/api-hub/route-manifest.ts`.
3. Add or update the owning module in `shared/modules/registry/*`, including `apis`, `data`, `integrations`, and governance notes.
4. Verify `/system/api-catalog` shows the route under the expected project, feature, role, module, and data source.
5. Run `NODE_OPTIONS=--max-old-space-size=4096 npm run check`, `npm run lint`, and `npm run check:modules`.

`inferred module matches` are accepted for legacy or broad router surfaces, but new production APIs should prefer exact `MODULE_REGISTRY.apis` bindings.
