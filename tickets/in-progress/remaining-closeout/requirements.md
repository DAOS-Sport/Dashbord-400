# Remaining Closeout Requirements

Status: Draft

## User Goal

Finish the remaining planned work, add per-module verification coverage, run a complete dry-run, and report the final status.

## Scope

- Keep employee and supervisor core flows intact.
- Do not restart `/supervisor/settings`, widget layout builder, or module config CRUD.
- Close System / IT governance blockers that can be completed locally.
- Add deterministic module-level tests and a full local dry-run command.
- Update canonical docs after implementation.

## Acceptance Criteria

- System module-registry debug endpoints require system role plus explicit system governance permission.
- Raw Inspector uses a server-side whitelist endpoint and records audit for every query.
- System audit page can read latest audit rows through a system-only API.
- Module tests cover employee, supervisor, system, raw-inspector, telemetry/audit, registry, and dry-run contracts.
- Full dry-run runs type-check, module registry check, module smoke, module unit tests, and build.
