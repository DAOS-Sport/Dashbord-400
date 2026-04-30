# Phase 0.1a Schema and Write-Path Audit

Baseline `git status -s` before audit: existing dirty tree included many modified app files, `PR-2-summary.md`, `client/src/shared/telemetry/correlation.ts`, `docs/audits/`, `migrations/0002_employee_resource_link_notes.sql`, `scripts/run-toolchain.cjs`, Ragic scripts/adapter, screenshots, and exports. This task only adds this file.

## A. Schema 欄位矩陣

### A.1 `tasks`

Schema 位置：`shared/schema.ts:184-217`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:185` |
| facilityKey / `facility_key` | text | NO | - | Where | `shared/schema.ts:186` |
| title | text | NO | - | What | `shared/schema.ts:187` |
| content | text | YES | - | What detail | `shared/schema.ts:188` |
| priority | text | NO | `normal` | - | business enum by zod: `low`, `normal`, `high`, `shared/schema.ts:189`, `shared/schema.ts:211` |
| status | text | NO | `pending` | - | business enum by zod: `pending`, `in_progress`, `done`, `cancelled`, `shared/schema.ts:190`, `shared/schema.ts:212` |
| source | text | NO | `employee` | How / role-source混用 | zod enum is `employee`, `supervisor`, `system`, `shared/schema.ts:191`, `shared/schema.ts:213` |
| createdByUserId / `created_by_user_id` | text | NO | - | Who-create | employee/session user id, `shared/schema.ts:192` |
| createdByName / `created_by_name` | text | NO | - | Who snapshot | display snapshot, `shared/schema.ts:193` |
| assignedToUserId / `assigned_to_user_id` | text | YES | - | Assignment | `shared/schema.ts:194` |
| assignedToName / `assigned_to_name` | text | YES | - | Assignment snapshot | `shared/schema.ts:195` |
| dueAt / `due_at` | timestamp | YES | - | When-due | `shared/schema.ts:196` |
| completedAt / `completed_at` | timestamp | YES | - | When-complete | `shared/schema.ts:197` |
| createdAt / `created_at` | timestamp | NO | now() | When-create | `shared/schema.ts:198` |
| updatedAt / `updated_at` | timestamp | NO | now() | When-update | `shared/schema.ts:199` |
| **缺：createdByRole** | - | - | - | Who-create-role | 需 0.1b 補 |
| **缺：updatedBy** | - | - | - | Who-update | 需 0.1b 補 |
| **缺：assignedBy / assignedAt** | - | - | - | Assignment actor | 主管派發 actor 未獨立保存 |

**5W1H 完整度評估**
- Who-create: 部分。`createdByUserId` + `createdByName` exists, but role missing.
- When-create: ✓
- Who-update: ✗
- When-update: ✓
- Where (facility): ✓
- How (source): 部分。`source` exists but currently stores role/source actor (`employee|supervisor|system`), not transport/source (`manual|agent|webhook|migration`).

**重要欄位語意確認**
- `source`: enum declared as `employee`, `supervisor`, `system`; write path sets `manager ? "supervisor" : "employee"` at `server/modules/tasks/index.ts:108`.
- `priority`: `low`, `normal`, `high`.
- `status`: `pending`, `in_progress`, `done`, `cancelled`.

### A.2 `system_announcements`

Schema 位置：`shared/schema.ts:282-304`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:283` |
| title | text | NO | - | What | `shared/schema.ts:284` |
| content | text | NO | - | What detail | `shared/schema.ts:285` |
| severity | text | NO | `info` | Business priority | zod enum `info`, `warning`, `critical`, `shared/schema.ts:286`, `shared/schema.ts:300` |
| facilityKey / `facility_key` | text | YES | - | Where | single facility or null/all, `shared/schema.ts:287` |
| publishedAt / `published_at` | timestamp | NO | now() | When-publish | draft/publish split not represented, `shared/schema.ts:288` |
| expiresAt / `expires_at` | timestamp | YES | - | When-expire | `shared/schema.ts:289` |
| isActive / `is_active` | boolean | NO | true | State | `shared/schema.ts:290` |
| createdAt / `created_at` | timestamp | NO | now() | When-create | `shared/schema.ts:291` |
| **缺：createdBy** | - | - | - | Who-create | 需 0.1b 補 |
| **缺：createdByRole** | - | - | - | Who-create-role | 需 0.1b 補 |
| **缺：updatedAt** | - | - | - | When-update | 需 0.1b 補 |
| **缺：updatedBy** | - | - | - | Who-update | 需 0.1b 補 |
| **缺：source** | - | - | - | How | 需 0.1b 補 |
| **缺：facilityKeys** | - | - | - | Where multi | 多館/全公司語意未正式建模 |
| **缺：publishedBy** | - | - | - | Who-publish | 需後續決策 |

**5W1H 完整度評估**
- Who-create: ✗
- When-create: ✓
- Who-update: ✗
- When-update: ✗
- Where (facility): 部分。single nullable `facilityKey` only.
- How (source): ✗

**重要欄位語意確認**
- `severity`: `info`, `warning`, `critical`.
- `facilityKey`: storage query treats `facilityKey = requested OR NULL` as visible for a facility at `server/storage.ts:334-342`.

### A.3 `handover_entries`

Schema 位置：`shared/schema.ts:120-138`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:121` |
| facilityKey / `facility_key` | text | NO | - | Where | `shared/schema.ts:122` |
| content | text | NO | What | - | `shared/schema.ts:123` |
| authorEmployeeNumber / `author_employee_number` | text | YES | - | Who-create | legacy/canonical mismatch, `shared/schema.ts:124` |
| authorName / `author_name` | text | YES | - | Who snapshot | legacy display snapshot, `shared/schema.ts:125` |
| createdAt / `created_at` | timestamp | NO | now() | When-create | `shared/schema.ts:126` |
| **缺：createdByRole** | - | - | - | Who-create-role | 需 0.1b 補 |
| **缺：updatedAt** | - | - | - | When-update | 需 0.1b 補，如仍保留此表寫入 |
| **缺：updatedBy** | - | - | - | Who-update | 需 0.1b 補，如仍保留此表寫入 |
| **缺：source** | - | - | - | How | 需 0.1b 補 |

**5W1H 完整度評估**
- Who-create: 部分。`authorEmployeeNumber` exists, role missing.
- When-create: ✓
- Who-update: ✗
- When-update: ✗
- Where (facility): ✓
- How (source): ✗

**重要欄位語意確認**
- This is legacy portal handover write path. New employee handover module writes `operational_handovers`, not this table.

### A.4 `operational_handovers`

Schema 位置：`shared/schema.ts:140-182`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:141` |
| facilityKey / `facility_key` | text | NO | Where | - | `shared/schema.ts:142` |
| title | text | NO | - | What | `shared/schema.ts:143` |
| content | text | NO | - | What detail | `shared/schema.ts:144` |
| priority | text | NO | `normal` | Business priority | zod enum `low`, `normal`, `high`, `shared/schema.ts:145`, `shared/schema.ts:175` |
| status | text | NO | `pending` | Business state | zod enum `pending`, `claimed`, `in_progress`, `reported`, `done`, `cancelled`, `shared/schema.ts:146`, `shared/schema.ts:176` |
| targetDate / `target_date` | text | NO | - | When-target | `YYYY-MM-DD`, `shared/schema.ts:147`, `shared/schema.ts:177` |
| targetShiftLabel / `target_shift_label` | text | NO | - | Business schedule label | `shared/schema.ts:148` |
| visibleFrom / `visible_from` | timestamp | YES | - | When-visible | `shared/schema.ts:149` |
| dueAt / `due_at` | timestamp | YES | - | When-due | `shared/schema.ts:150` |
| assigneeEmployeeNumber / `assignee_employee_number` | text | YES | - | Assignment | `shared/schema.ts:151` |
| assigneeName / `assignee_name` | text | YES | - | Assignment snapshot | `shared/schema.ts:152` |
| claimedByEmployeeNumber / `claimed_by_employee_number` | text | YES | - | Who-claim | `shared/schema.ts:153` |
| claimedByName / `claimed_by_name` | text | YES | - | Claim snapshot | `shared/schema.ts:154` |
| createdByEmployeeNumber / `created_by_employee_number` | text | YES | - | Who-create | `shared/schema.ts:155` |
| createdByName / `created_by_name` | text | YES | - | Who snapshot | `shared/schema.ts:156` |
| reportedByEmployeeNumber / `reported_by_employee_number` | text | YES | - | Who-update/report | `shared/schema.ts:157` |
| reportedByName / `reported_by_name` | text | YES | - | Report snapshot | `shared/schema.ts:158` |
| reportNote / `report_note` | text | YES | - | Update content | `shared/schema.ts:159` |
| linkedActionType / `linked_action_type` | text | YES | - | Related action | `shared/schema.ts:160` |
| linkedActionUrl / `linked_action_url` | text | YES | - | Related action URL | `shared/schema.ts:161` |
| completedAt / `completed_at` | timestamp | YES | - | When-complete | `shared/schema.ts:162` |
| createdAt / `created_at` | timestamp | NO | now() | When-create | `shared/schema.ts:163` |
| updatedAt / `updated_at` | timestamp | NO | now() | When-update | `shared/schema.ts:164` |
| **缺：createdByRole** | - | - | - | Who-create-role | 需 0.1b 補 |
| **缺：updatedBy** | - | - | - | Who-update canonical | Currently split across claimed/reported fields |
| **缺：source** | - | - | - | How | 需 0.1b 補 |
| **缺：progressPercent / progressStatus** | - | - | - | Business progress | Not present |

**5W1H 完整度評估**
- Who-create: 部分。created employee number/name exist, role missing.
- When-create: ✓
- Who-update: 部分。claimed/reported actor fields exist, no canonical `updatedBy`.
- When-update: ✓
- Where (facility): ✓
- How (source): ✗

**重要欄位語意確認**
- Employee home handover module maps this table at `server/modules/handover/index.ts:43-56`.
- Employee handover create path writes `targetShiftLabel: "交辦事項"` at `server/modules/handover/index.ts:139-160`.

### A.5 `employee_resources`

Schema 位置：`shared/schema.ts:247-280`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:248` |
| facilityKey / `facility_key` | text | NO | - | Where | `shared/schema.ts:249` |
| category | text | NO | - | What subtype | zod enum `event`, `document`, `sticky_note`, `announcement`, `shared/schema.ts:250`, `shared/schema.ts:270` |
| subCategory / `sub_category` | text | YES | - | Classification | `shared/schema.ts:251` |
| title | text | NO | - | What | `shared/schema.ts:252` |
| content | text | YES | - | What detail | `shared/schema.ts:253` |
| url | text | YES | - | Related URL | allows relative `/...` or URL, `shared/schema.ts:254`, `shared/schema.ts:242-245` |
| isPinned / `is_pinned` | boolean | NO | false | Display state | `shared/schema.ts:255` |
| sortOrder / `sort_order` | integer | NO | 100 | Display order | `shared/schema.ts:256` |
| scheduledAt / `scheduled_at` | timestamp | YES | - | When-scheduled | `shared/schema.ts:257` |
| createdByEmployeeNumber / `created_by_employee_number` | text | YES | - | Who-create | `shared/schema.ts:258` |
| createdByName / `created_by_name` | text | YES | - | Who snapshot | `shared/schema.ts:259` |
| createdAt / `created_at` | timestamp | NO | now() | When-create | `shared/schema.ts:260` |
| updatedAt / `updated_at` | timestamp | NO | now() | When-update | `shared/schema.ts:261` |
| **缺：createdByRole** | - | - | - | Who-create-role | 需 0.1b 補 |
| **缺：updatedBy** | - | - | - | Who-update | 需 0.1b 補 |
| **缺：source** | - | - | - | How | 需 0.1b 補 |
| **缺：isPrivate** | - | - | - | Privacy | sticky_note requirement not represented |

**5W1H 完整度評估**
- Who-create: 部分。employee number/name exist, role missing.
- When-create: ✓
- Who-update: ✗
- When-update: ✓
- Where (facility): ✓
- How (source): ✗

**重要欄位語意確認**
- `category` currently does not include `training`; employee training would require either enum expansion or separate table.
- `sticky_note` uses same table as documents/events.

### A.6 `quick_links`

Schema 位置：`shared/schema.ts:219-240`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:220` |
| facilityKey / `facility_key` | text | YES | - | Where | nullable/global, `shared/schema.ts:221` |
| title | text | NO | - | What | `shared/schema.ts:222` |
| url | text | NO | - | Related URL | zod requires URL only, `shared/schema.ts:223`, `shared/schema.ts:236` |
| icon | text | YES | - | Display | `shared/schema.ts:224` |
| description | text | YES | - | What detail | `shared/schema.ts:225` |
| sortOrder / `sort_order` | integer | NO | 0 | Display order | `shared/schema.ts:226` |
| isActive / `is_active` | boolean | NO | true | State | `shared/schema.ts:227` |
| createdAt / `created_at` | timestamp | NO | now() | When-create | `shared/schema.ts:228` |
| **缺：createdBy** | - | - | - | Who-create | 需 0.1b 補 |
| **缺：createdByRole** | - | - | - | Who-create-role | 需 0.1b 補 |
| **缺：updatedAt** | - | - | - | When-update | 需 0.1b 補 |
| **缺：updatedBy** | - | - | - | Who-update | 需 0.1b 補 |
| **缺：source** | - | - | - | How | 需 0.1b 補 |

**5W1H 完整度評估**
- Who-create: ✗
- When-create: ✓
- Who-update: ✗
- When-update: ✗
- Where (facility): 部分. nullable global/facility scoped.
- How (source): ✗

**重要欄位語意確認**
- Storage list treats `facilityKey = requested OR NULL` as visible for a facility at `server/storage.ts:278-286`.

### A.7 `anomaly_reports`

Schema 位置：`shared/schema.ts:71-100`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:72` |
| employeeId / `employee_id` | integer | YES | - | Who-subject | `shared/schema.ts:73` |
| employeeName / `employee_name` | text | YES | - | Who snapshot | `shared/schema.ts:74` |
| employeeCode / `employee_code` | text | YES | - | Who-subject | `shared/schema.ts:75` |
| role | text | YES | - | Who-subject role | `shared/schema.ts:76` |
| lineUserId / `line_user_id` | text | YES | - | External identity | `shared/schema.ts:77` |
| context | text | NO | - | What | `shared/schema.ts:78` |
| clockStatus / `clock_status` | text | YES | - | Business state | `shared/schema.ts:79` |
| clockType / `clock_type` | text | YES | - | Business type | `shared/schema.ts:80` |
| clockTime / `clock_time` | text | YES | - | When-event | `shared/schema.ts:81` |
| venueName / `venue_name` | text | YES | - | Where label | `shared/schema.ts:82` |
| distance | text | YES | - | Context | `shared/schema.ts:83` |
| failReason / `fail_reason` | text | YES | - | Why/failure reason | `shared/schema.ts:84` |
| errorMsg / `error_msg` | text | YES | - | Error detail | `shared/schema.ts:85` |
| userNote / `user_note` | text | YES | - | Submitted note | `shared/schema.ts:86` |
| imageUrls / `image_urls` | text[] | YES | - | Attachments | `shared/schema.ts:87` |
| reportText / `report_text` | text | YES | - | Rendered report | `shared/schema.ts:88` |
| resolution | text | YES | `pending` | State | route validates `pending` / `resolved`, `shared/schema.ts:89`, `server/routes.ts:464-467` |
| resolvedNote / `resolved_note` | text | YES | - | Resolution note | `shared/schema.ts:90` |
| createdAt / `created_at` | timestamp | NO | now() | When-create/received | `shared/schema.ts:91` |
| **缺：facilityKey** | - | - | - | Where canonical | only `venueName` exists |
| **缺：source** | - | - | - | How | external source not represented |
| **缺：receivedAt** | - | - | - | When-received | `createdAt` currently doubles as received time |
| **缺：resolvedBy / resolvedAt** | - | - | - | Who/When-update | resolution actor/time missing |
| **缺：updatedAt / updatedBy** | - | - | - | Who/When-update | 需 0.1b 或 later 補 |

**5W1H 完整度評估**
- Who-create: 部分. subject employee exists, actor/source system missing.
- When-create: ✓
- Who-update: ✗
- When-update: ✗
- Where (facility): 部分. `venueName` only, no canonical `facilityKey`.
- How (source): ✗

**重要欄位語意確認**
- Anomaly create endpoint receives external-looking payload and writes report via storage at `server/routes.ts:361-378`.
- Resolution update writes `resolution` and `resolvedNote` only at `server/storage.ts:132-138`.

### A.8 `notification_recipients`

Schema 位置：`shared/schema.ts:102-118`

| 欄位 | 型別 | nullable | default | 5W1H 對應 | 備註 |
|---|---|---:|---|---|---|
| id | serial | NO | - | - | PK, `shared/schema.ts:103` |
| email | text | NO | - | What/contact target | `shared/schema.ts:104` |
| label | text | YES | - | Display | `shared/schema.ts:105` |
| enabled | boolean | NO | true | State | `shared/schema.ts:106` |
| notifyNewReport / `notify_new_report` | boolean | NO | true | Notification config | `shared/schema.ts:107` |
| notifyResolution / `notify_resolution` | boolean | NO | true | Notification config | `shared/schema.ts:108` |
| createdAt / `created_at` | timestamp | NO | now() | When-create | `shared/schema.ts:109` |
| **缺：createdBy** | - | - | - | Who-create | 需 0.1b 補 |
| **缺：createdByRole** | - | - | - | Who-create-role | 需 0.1b 補 |
| **缺：updatedAt** | - | - | - | When-update | 需 0.1b 補 |
| **缺：updatedBy** | - | - | - | Who-update | 需 0.1b 補 |
| **缺：facilityKey** | - | - | - | Where | global notification settings currently |
| **缺：source** | - | - | - | How | 需 0.1b 補 |

**5W1H 完整度評估**
- Who-create: ✗
- When-create: ✓
- Who-update: ✗
- When-update: ✗
- Where (facility): ✗ / global table.
- How (source): ✗

**重要欄位語意確認**
- No enum fields beyond booleans.

## B. 寫入點熱度圖

### B.1 `tasks` 寫入點

#### INSERT（storage DB 1 處；route caller 1 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:259-261` | receives `InsertTask` from caller | DB direct insert; no actor derivation in storage | 中（centralized storage helper） |
| `server/modules/tasks/index.ts:96-116` | `req.workbenchSession!.userId`, `displayName`, active/granted facility | created user/name/facility/source present; created role/update actor missing | 中（module route clean, but source mixes role semantics） |

#### UPDATE（storage DB 1 處；route caller 2 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| `server/storage.ts:264-270` | updates `updatedAt`, not `updatedBy` | 中 |
| `server/modules/tasks/index.ts:122-133` | caller builds patch; storage bumps `updatedAt` only | 中 |
| `server/modules/tasks/index.ts:139-153` | status patch; storage bumps `updatedAt` only | 中 |

#### 觀察
- Writes are concentrated in `server/modules/tasks/index.ts` + `server/storage.ts`.
- No BFF write found for `tasks`.

### B.2 `system_announcements` 寫入點

#### INSERT（storage DB 1 處；route caller 1 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:345-347` | receives `InsertSystemAnnouncement` | DB direct insert; no actor derivation in storage | 中 |
| `server/routes.ts:1512-1520` | `requireSupervisor()` caller exists but actor is not passed into insert data | created actor/role/source missing | 高（legacy `server/routes.ts`) |

#### UPDATE（storage DB 1 處；route caller 1 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| `server/storage.ts:350-352` | does not update `updatedAt`; no `updatedBy` field | 高 |
| `server/routes.ts:1527-1533` | passes raw `req.body` to storage | 高 |

#### 觀察
- Writes are legacy route + storage.
- No BFF direct write found.

### B.3 `handover_entries` 寫入點

#### INSERT（storage DB 1 處；route caller 1 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:186-188` | receives `InsertHandoverEntry` | DB direct insert; no actor derivation in storage | 中 |
| `server/routes.ts:1034-1058` | `requireEmployee()` caller; forces `authorEmployeeNumber` and `authorName` from caller | who-create partial, facility present, role/source/update missing | 中（legacy but identity forced from caller） |

#### UPDATE（0 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| 未找到 | 搜過 `db.update(handoverEntries)` and `storage.updateHandover` | - |

#### 觀察
- `handover_entries` appears legacy/simple note table.
- Current employee handover module uses `operational_handovers`, not this table.

### B.4 `operational_handovers` 寫入點

#### INSERT（storage DB 1 處；route callers 2 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:213-215` | receives `InsertOperationalHandover` | DB direct insert; no actor derivation in storage | 中 |
| `server/routes.ts:1155-1201` | `requireSupervisor()` caller; writes `createdByEmployeeNumber` / `createdByName` | who-create partial, facility present, role/source missing | 中（legacy route, supervisor-only） |
| `server/modules/handover/index.ts:132-171` | `requireSession`; writes `createdByEmployeeNumber` / `createdByName` from workbench session | who-create partial, facility present, role/source missing | 中（module route clean） |

#### UPDATE（storage DB 1 處；route callers 5 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| `server/storage.ts:218-233` | updates `updatedAt`, not `updatedBy`; domain-specific claimed/reported fields supported | 中 |
| `server/routes.ts:1208-1223` | supervisor patch; `updatedAt` via storage only | 中 |
| `server/routes.ts:1230-1258` | employee report/claim writes claimed/reported actor fields | 中 |
| `server/modules/handover/index.ts:178-201` | complete writes `reportedByEmployeeNumber` / `reportedByName` / `completedAt` | 中 |
| `server/modules/handover/index.ts:208-221` | read/claim writes `claimedByEmployeeNumber` / `claimedByName` | 中 |
| `server/modules/handover/index.ts:228-244` | reply writes `reportedByEmployeeNumber` / `reportedByName` and note | 中 |

#### 觀察
- Writes are split across legacy portal routes and new module routes.
- This is the highest-impact handover table for current employee UI.
- No BFF direct write found; BFF summary/list reads through module route.

### B.5 `employee_resources` 寫入點

#### INSERT（storage DB 1 處；route caller 1 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:315-317` | receives `InsertEmployeeResource` | DB direct insert; no actor derivation in storage | 中 |
| `server/routes.ts:1421-1442` | `requireEmployee()` caller; forces `createdByEmployeeNumber` and `createdByName` | who-create partial, facility present, role/source missing | 低-中 |

#### UPDATE（storage DB 1 處；route caller 1 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| `server/storage.ts:320-326` | updates `updatedAt`, not `updatedBy` | 中 |
| `server/routes.ts:1450-1472` | requires owner/supervisor; storage bumps `updatedAt` only | 中 |

#### 觀察
- Writes are concentrated in `server/routes.ts` + `server/storage.ts`.
- Category-specific `sticky_note` is not separated at write-path level; same create/update handles all `employee_resources` categories.

### B.6 `quick_links` 寫入點

#### INSERT（storage DB 1 處；route caller 1 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:289-291` | receives `InsertQuickLink` | DB direct insert; no actor derivation in storage | 中 |
| `server/routes.ts:1359-1367` | `requireSupervisor()` caller; actor is not passed into insert data | who/source missing | 低-中 |

#### UPDATE（storage DB 1 處；route caller 1 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| `server/storage.ts:294-296` | no `updatedAt`; no `updatedBy` field | 中 |
| `server/routes.ts:1374-1380` | passes raw `req.body` to storage | 中 |

#### 觀察
- Smallest write surface among candidate domain tables.
- Schema currently lacks update metadata entirely, so 0.1b must add columns before helper retrofit can be meaningful.

### B.7 `anomaly_reports` 寫入點

#### INSERT（storage DB 1 處；route caller 1 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:118-120` | receives `InsertAnomalyReport` | DB direct insert; no source/facility/actor normalization | 中 |
| `server/routes.ts:361-378` | external-ish request body (`employee`, `clockResult`, files) | subject/clock data present; source/facilityKey/receivedAt missing | 高（legacy multipart/external endpoint） |

#### UPDATE（storage DB 2 處；route callers 2 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| `server/storage.ts:132-138` | sets `resolution`, `resolvedNote`; no actor/time | 高 |
| `server/storage.ts:141-147` | batch sets `resolution`, `resolvedNote`; no actor/time | 高 |
| `server/routes.ts:459-474` | single resolution update; no session/actor captured | 高 |
| `server/routes.ts:480-497` | batch resolution update; no session/actor captured | 高 |

#### 觀察
- Legacy route; no explicit auth/session guard in shown resolution endpoints.
- Email side effects occur after update at `server/routes.ts:472` and `server/routes.ts:493-494`.

### B.8 `notification_recipients` 寫入點

#### INSERT（storage DB 1 處；route caller 1 處）
| file:line | actor 來源 | 5W1H 完整度 | 風險評估 |
|---|---|---|---|
| `server/storage.ts:159-161` | receives `InsertNotificationRecipient` | DB direct insert; no actor/source | 中 |
| `server/routes.ts:558-571` | no auth/session actor in route; validates email | who/source/facility missing | 高 |

#### UPDATE（storage DB 1 處；route caller 1 處）
| file:line | 是否更新 updated_at/by | 風險評估 |
|---|---|---|
| `server/storage.ts:164-166` | no `updatedAt`; no `updatedBy` field | 中 |
| `server/routes.ts:577-591` | sanitized fields only, but no actor | 高 |

#### 觀察
- Settings table write path is legacy route + storage.
- No BFF direct write found.

## C. 風險與依賴分析

### C.1 寫入點分佈摘要

| Table | INSERT 數 | UPDATE 數 | 集中度 | 主要位置 |
|---|---:|---:|---|---|
| tasks | 1 DB + 1 caller | 1 DB + 2 callers | 高 | `server/modules/tasks/index.ts`, `server/storage.ts` |
| system_announcements | 1 DB + 1 caller | 1 DB + 1 caller | 中 | `server/routes.ts`, `server/storage.ts` |
| handover_entries | 1 DB + 1 caller | 0 | 中 | `server/routes.ts`, `server/storage.ts` |
| operational_handovers | 1 DB + 2 callers | 1 DB + 5 callers | 中 | `server/modules/handover/index.ts`, `server/routes.ts`, `server/storage.ts` |
| employee_resources | 1 DB + 1 caller | 1 DB + 1 caller | 中 | `server/routes.ts`, `server/storage.ts` |
| quick_links | 1 DB + 1 caller | 1 DB + 1 caller | 中 | `server/routes.ts`, `server/storage.ts` |
| anomaly_reports | 1 DB + 1 caller | 2 DB + 2 callers | 低 | legacy `server/routes.ts`, `server/storage.ts` |
| notification_recipients | 1 DB + 1 caller | 1 DB + 1 caller | 低 | legacy `server/routes.ts`, `server/storage.ts` |

### C.2 5W1H 缺口統計

| 5W1H 維度 | 完全有的表 | 部分有的表 | 完全缺的表 |
|---|---|---|---|
| Who-create | - | tasks, handover_entries, operational_handovers, employee_resources, anomaly_reports | system_announcements, quick_links, notification_recipients |
| When-create | tasks, system_announcements, handover_entries, operational_handovers, employee_resources, quick_links, anomaly_reports, notification_recipients | - | - |
| Who-update | - | operational_handovers | tasks, system_announcements, handover_entries, employee_resources, quick_links, anomaly_reports, notification_recipients |
| When-update | tasks, operational_handovers, employee_resources | - | system_announcements, handover_entries, quick_links, anomaly_reports, notification_recipients |
| Where (facility) | tasks, handover_entries, operational_handovers, employee_resources | system_announcements, quick_links, anomaly_reports | notification_recipients |
| How (source) | - | tasks | system_announcements, handover_entries, operational_handovers, employee_resources, quick_links, anomaly_reports, notification_recipients |

### C.3 命名一致性問題

- Who-create names differ:
  - `tasks.createdByUserId` / `tasks.createdByName` at `shared/schema.ts:192-193`.
  - `handover_entries.authorEmployeeNumber` / `authorName` at `shared/schema.ts:124-125`.
  - `operational_handovers.createdByEmployeeNumber` / `createdByName` at `shared/schema.ts:155-156`.
  - `employee_resources.createdByEmployeeNumber` / `createdByName` at `shared/schema.ts:258-259`.
- Subject employee vs actor employee are mixed in `anomaly_reports`: `employeeId`, `employeeName`, `employeeCode`, `role` at `shared/schema.ts:73-76` describe report subject, not necessarily creator/processor.
- Where names differ:
  - Canonical `facilityKey` exists on tasks/handover/employee resources/quick links/system announcements.
  - `anomaly_reports` only has `venueName` at `shared/schema.ts:82`.
- Update actor names are domain-specific in `operational_handovers`:
  - `claimedByEmployeeNumber` at `shared/schema.ts:153`.
  - `reportedByEmployeeNumber` at `shared/schema.ts:157`.
  - no canonical `updatedBy`.

### C.4 既有 legacy 欄位清單

| Table | Legacy 欄位 | 為什麼是 legacy | 0.1b 處理建議 |
|---|---|---|---|
| handover_entries | `author_employee_number`, `author_name` | early portal handover identity fields; not aligned to created_by naming | 保留，不動，不 rename |
| operational_handovers | `created_by_employee_number`, `created_by_name`, `claimed_by_*`, `reported_by_*` | domain-specific actor snapshots already used by UI/API | 保留，不動，不 rename |
| employee_resources | `created_by_employee_number`, `created_by_name` | existing owner/edit checks use these fields at `server/routes.ts:1455-1459` and `server/routes.ts:1485-1489` | 保留，不動，不 rename |
| anomaly_reports | `employee_name`, `employee_code`, `venue_name` | external anomaly payload snapshots; not canonical actor/facility | 保留，不動，不 rename |
| tasks | `created_by_user_id`, `created_by_name` | current task permission checks rely on `createdByUserId` at `server/modules/tasks/index.ts:37-48` | 保留，不動，不 rename |

## D. 0.1c 第一棒驗證候選評估

### D.1 `quick_links`

- 寫入點數量：1 insert caller, 1 update caller, plus storage insert/update.
- 寫入點集中度：中； legacy `server/routes.ts` routes call centralized `server/storage.ts`.
- 既有 5W1H 完整度：only `createdAt` and optional `facilityKey`; no create actor, update actor/time, or source.
- 預估改造工作量：small after schema exists. Route can derive supervisor caller from `requireSupervisor()` path, then pass metadata into storage.
- 風險點：`server/routes.ts:1374-1380` passes raw `req.body` to update. Helper retrofit should not accidentally allow metadata fields from body.

### D.2 `employee_resources` (category=`sticky_note`)

- 寫入點數量：1 insert caller, 1 update caller, plus storage insert/update.
- 寫入點集中度：中; one legacy route block handles all categories, storage centralized.
- 既有 5W1H 完整度：facility, created employee number/name, createdAt, updatedAt exist; create role, update actor, source missing.
- 預估改造工作量：medium. The write path is not category-specific, so a sticky-note-only retrofit would need conditional behavior or it will affect documents/events too.
- 風險點：ownership/edit checks use `createdByEmployeeNumber` at `server/routes.ts:1455-1459` and delete checks at `server/routes.ts:1485-1489`; rename/removal would break authorization.

### D.3 不選 `tasks` 的具體理由

- Current task create/update is cleanly isolated in `server/modules/tasks/index.ts:96-153`, but the schema uses `source` as actor role at `shared/schema.ts:191` and `server/modules/tasks/index.ts:108`.
- `tasks` permission logic depends on `createdByUserId` and `assignedToUserId` at `server/modules/tasks/index.ts:37-48`.
- Adding assignment actor/history would expand beyond a simple metadata-helper validation.

**結論**
- 第一棒：`quick_links`.
- 第二棒：`employee_resources`, but not sticky-note-only unless a category-scoped service layer is introduced; the current route is shared across resource categories.

## E. 已知 migration 流程現況

### E.1 Drizzle 設定

- `drizzle.config.ts:1-14` uses `defineConfig`.
- Requires `DATABASE_URL`, otherwise throws at `drizzle.config.ts:3-5`.
- Migration output folder is `./migrations` at `drizzle.config.ts:8`.
- Schema path is `./shared/schema.ts` at `drizzle.config.ts:9`.
- Dialect is `postgresql` at `drizzle.config.ts:10`.

Existing migration files:
- Tracked: `migrations/0001_module_registry_contract.sql` (`git ls-files` lists it).
- Untracked: `migrations/0002_employee_resource_link_notes.sql`.

`migrations/0001_module_registry_contract.sql` creates module settings/permissions/overrides and telemetry support tables, including `ui_events` and `client_errors`, at `migrations/0001_module_registry_contract.sql:1-70`.

`migrations/0002_employee_resource_link_notes.sql` adds `sub_category`, `sort_order`, and `scheduled_at` to `employee_resources` at `migrations/0002_employee_resource_link_notes.sql:1-8`.

### E.2 npm scripts

- `package.json:16` has `"db:push": "drizzle-kit push"`.
- No `db:generate` script found in `package.json`.
- No `db:migrate` script found in `package.json`.

### E.3 `package.json` 中所有 db 相關 script

| script | command | source |
|---|---|---|
| db:push | `drizzle-kit push` | `package.json:16` |

### E.4 過往使用模式判讀

- Repo contains a hand-written-looking SQL migration file `migrations/0001_module_registry_contract.sql` with `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements at `migrations/0001_module_registry_contract.sql:1-70`.
- `migrations/0002_employee_resource_link_notes.sql` is untracked and also hand-written-looking additive SQL at `migrations/0002_employee_resource_link_notes.sql:1-8`.
- There is no `drizzle/meta` folder found by `Get-ChildItem -Path migrations,drizzle`.
- `package.json` exposes `db:push` only, not generate/migrate.

判讀：目前 repo 更像是 `db:push` plus manual SQL files, not a verified Drizzle generate/migrate workflow. Migration 流程未驗證，0.1b 開工前需要先驗證一次 generate→push 或明確決定使用 hand-authored additive SQL。

## F. Halt / Out-of-Scope Findings

### F.1 Halt Reason

None.

### F.2 Out-of-Scope Findings

- `quick_links` insert schema requires `url` to be full URL (`shared/schema.ts:236`), while `employee_resources` has `linkUrlSchema` allowing relative routes (`shared/schema.ts:242-245`). This matters because user-facing quick links may need internal routes.
- `system_announcements` has `publishedAt` defaulting to now and not nullable at `shared/schema.ts:288`, so draft vs publish state cannot be represented without changing semantics.
- `employee_resources` category enum does not include `training` at `shared/schema.ts:270`, but the product direction includes employee training materials.
- `anomaly_reports` resolution endpoints shown at `server/routes.ts:459-497` do not capture resolver actor/time in the table.
- `notification_recipients` create/update routes shown at `server/routes.ts:558-591` do not show auth/session-derived actor capture.
