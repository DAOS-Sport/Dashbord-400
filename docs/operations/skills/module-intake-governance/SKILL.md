---
name: module-intake-governance
description: Use this skill before accepting, planning, or implementing any new CMS module, feature, route, integration, permission, Ragic-backed flow, or LINE Bot capability. It enforces the mandatory three-field intake answer: role, Ragic database, and feature purpose.
---

# Module Intake Governance

Use this skill whenever a new module or feature is proposed for the 400QIAN CMS or its connected 400LINE services.

Before implementation, the response must include all three fields below. Missing one field is not allowed.

## Mandatory Intake Answer

```text
1. 角色：
2. RAGIC 資料庫：
3. 功能 / 需求 / 用途：
```

## Field Rules

### 1. 角色

Name the owning role first:

- `employee`
- `lifeguard`
- `supervisor`
- `system`
- `SYSTEM_ADMIN`

If multiple roles are involved, separate ownership from visibility:

```text
1. 角色：system owns; supervisor can view; employee is affected
```

Do not add a role-neutral module. Every module must have an owner role.

### 2. RAGIC 資料庫

Name the exact Ragic sheet/database/code that is the source of truth.

Examples:

- `Ragic H01 員工資料`
- `Ragic H05 場館 / 部門資料`
- `Ragic 慎用名單`

If the feature does not use Ragic, still fill the field:

```text
2. RAGIC 資料庫：不使用 Ragic；source of truth is <system/table/API>
```

If the Ragic source cannot be identified, stop before coding and answer:

```text
2. RAGIC 資料庫：待確認，不能實作
```

Then ask only for the missing Ragic source.

### 3. 功能 / 需求 / 用途

State what the feature does and why it exists in operational terms.

This field must explain:

- the user action or workflow
- the business purpose
- the expected output or state change

Avoid vague labels such as "管理功能", "查詢功能", or "新增頁面" without the concrete workflow.

## Required Response Shape

For any new module or feature request, start with:

```text
Module Intake Gate
1. 角色：...
2. RAGIC 資料庫：...
3. 功能 / 需求 / 用途：...
```

Then continue with the normal execution plan or implementation.

## Blocking Rule

Do not create or modify these surfaces until the three-field gate is complete:

- module registry entries
- routes
- BFF endpoints
- database tables or migrations
- Ragic adapters
- LINE Bot permission or whitelist logic
- navigation entries
- UI pages

If the three fields can be inferred from existing repository files, fill them and proceed. If any field cannot be inferred, pause and ask for that one missing field only.

## Cleanliness Rule

After implementation, verify that the module still has one clear owner and one clear source of truth:

- module registry owner role matches the intake role
- BFF route belongs to the same role boundary
- Ragic adapter or non-Ragic source matches the intake answer
- UI text and navigation do not imply a different owner
