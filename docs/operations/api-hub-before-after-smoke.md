# API Hub Before/After Smoke

Generated: 2026-05-22

## Phase 0 Baseline

- Source inventory: `docs/architecture/api-inventory.md`
- Baseline endpoint rows: 303
- Scanned route-pattern files: 33
- Explicit registration files: `server/routes.ts`, `server/modules/register.ts`, `server/app/http/register-routes.ts`

## Phase 1 Registration Shape

- Single registration entry: `server/modules/api-hub/index.ts`
- Public Express entry: `server/routes.ts` delegates only to `registerApiHub`.
- Route manifest: `server/modules/api-hub/route-manifest.ts`
- Manifest entries: 303
- Handler registration order is preserved from the pre-Hub `server/routes.ts` and `server/app/http/register-routes.ts` ordering.
- Success response bodies are not wrapped or rewritten.
- Error envelope remains `{ message, code }`, now provided by `apiHubErrorHandler`.
- Correlation id continues to be provided by the existing global `correlationMiddleware`.

## Verification

| Check | Result |
| --- | --- |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run check` | pass |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run smoke:modules` | pass |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run check:modules` | pass |

## Notes

- `npm run check` needs a larger Node heap in this workspace; without `NODE_OPTIONS=--max-old-space-size=4096`, tsc can abort before reporting type diagnostics.
- No handler body was moved into the Hub. The Hub owns route registration, middleware placement, static upload guards, and the manifest.
