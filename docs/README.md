# Documentation Index

Last updated: 2026-05-15

This directory is organized by document purpose. Keep new files in the closest matching folder instead of adding more loose Markdown files under `docs/`.

## Active Folders

- `architecture/`: system shape, frontend/backend/data-layer architecture, and module architecture notes.
- `governance/`: module registry, permission matrix, workbench governance, IT/System operating rules.
- `integrations/`: Replit, Ragic, API, migration, and external data connection guides.
- `planning/`: phase maps, construction maps, implementation plans, acceptance gates, and product scope documents.
- `operations/`: runtime cleanup notes, construction router rules, and operational runbooks.
- `design/`: design-system migration notes and UI/UX review protocols.
- `audits/`: dated audit reports and readiness gate results.
- `specs/`: feature or module specifications.
- `superpowers/`: execution plans created for Superpowers-driven implementation.
- `ADR/`: architecture decision records.
- `archive/`: historical PR summaries, screenshots, duplicates, and other trace-only material.

## Root-Level Documents

Repository root should stay limited to runnable project config and high-signal operator files such as:

- `KNOWN_ISSUES.md`
- `DESIGN.md`
- `SYSTEM_FULL_MAP.md`

Generated governance output now lives at `docs/governance/module-governance.md`; regenerate it with `npm run docs:module-governance`.
Replit runtime and secret wiring lives at `docs/integrations/replit-runtime-contract.md`.

## Classification Rules

- If a file describes how the system is built, put it in `architecture/`.
- If a file defines ownership, permissions, module registry rules, or IT governance, put it in `governance/`.
- If a file describes outside systems or deployment connectivity, put it in `integrations/`.
- If a file describes future work, phase order, or acceptance gates, put it in `planning/`.
- If a file is a historical snapshot or duplicate, put it in `archive/`.
