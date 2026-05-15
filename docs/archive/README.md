# Archive Index

Last updated: 2026-05-15

This folder keeps review artifacts that are useful for traceability but should not live at the repository root.

## Folders

- `pr-summaries/`: historical PR and phase summary notes.
- `ui-snapshots/`: browser screenshots and UI verification snapshots from previous implementation passes.
- `duplicates/`: duplicate or superseded documents kept only for traceability.

## Current Root Policy

- Keep runnable project files, package/config files, and high-signal operator docs at repository root.
- Keep audit reports under `docs/audits/`.
- Keep implementation plans under `docs/superpowers/plans/`.
- Keep generated runtime logs in ignored local folders such as `.tmp-codex/`.

## Do Not Archive

- Source files under `client/`, `server/`, `shared/`, `scripts/`, `migrations/`.
- Current governance documents such as `KNOWN_ISSUES.md`, `docs/governance/module-governance.md`, and active module registry docs.
