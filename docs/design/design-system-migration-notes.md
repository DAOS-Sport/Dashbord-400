# Design System Migration Notes

Phase A only extracts tokens and shared components. Existing module pages, BFF, APIs, routing, and module registration stay unchanged.

## Homepage Hardcoded Styles To Migrate Later

- `client/src/modules/employee/home/employee-home-page.tsx` repeats core workbench colors such as `#10233f`, `#0d2a50`, `#1cb4a3`, `#9dd84f`, `#007166`, `#8b9aae`, and `#637185` across header, cards, nav, tags, and empty states.
- `client/src/modules/employee/home/employee-home-page.tsx` repeats card surface styles: `rounded-[8px]`, `border-[#dfe7ef]`, `bg-white`, `bg-[#f7f9fb]`, and bespoke shadows.
- `client/src/modules/employee/home/employee-home-page.tsx` repeats bilingual section labels with `text-[10px] font-bold uppercase tracking[...]`; these should move to `PageHeader` or a future `SectionHeader` during Phase B.
- `client/src/modules/supervisor/dashboard-page.tsx` duplicates many of the same workbench values, with supervisor-specific green tokens currently bridged through `.supervisor-workbench`.
- `client/src/index.css` already contains the closest source of truth for card shadows and workbench shell colors; Phase A mirrors those values into `client/src/design-system/tokens.ts` and CSS variables without replacing existing module code.

## Phase B Candidates

- Replace repeated module page headings with `PageHeader`.
- Replace list empty blocks with `EmptyState`.
- Replace priority/status pills with `PriorityTag` and `StatusTag`.
- Replace side form panels in handover, activity periods, and personal notes with `FormPanel`.
- Replace search inputs and tabs with `SearchBar` and `FilterTabs`.

## Phase C Deferred

- Fix the former employee task-page encoding/title issue.
- Rewire group announcement module registration and page title binding.
- Add group announcement editing, full list, pinned handling, and manual classification override.
