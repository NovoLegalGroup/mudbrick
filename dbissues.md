# Database Schema Issues — Mudbrick

## Overview

267 tables across three domains: internal CRM/intake pipeline, Filevine sync layer (~150+ `fv_*` tables), and supporting systems (AI calls, automation, webhooks, sync infrastructure).

---

## 1. Missing Foreign Keys (High Priority)

### 1a. `agent_calls.contact_id` — No FK to `contacts`

**Location**: `agent_calls` table, line 8 in DB.sql

```sql
intake_id uuid,    -- has FK -> intake_applications(id)
contact_id uuid,   -- NO FK. Bare uuid column.
```

**Risk**: Nothing prevents inserting a fabricated uuid, pointing to a deleted contact, or accidentally storing an ID from a different table. If a contact is deleted, call records silently become orphaned — joins return null, and "show all calls for this client" queries miss records.

**Evidence**: `intake_id` on the same table has a proper FK. This looks like `contact_id` was added later and the constraint was forgotten.

**Fix**:
```sql
-- First check for existing orphans:
SELECT ac.id, ac.contact_id
FROM agent_calls ac
LEFT JOIN contacts c ON c.id = ac.contact_id
WHERE ac.contact_id IS NOT NULL AND c.id IS NULL;

-- Then add the constraint:
ALTER TABLE agent_calls
  ADD CONSTRAINT agent_calls_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id);
```

---

### 1b. `proposals.contact_id` + `engagements.contact_id` — Redundant Contact Tracking

**Location**: `proposals` (line 4444) and `engagements` (line 258) in DB.sql

The chain `contacts -> intake_applications -> proposals -> engagements` already establishes contact ownership. But both `proposals` and `engagements` add their own direct `contact_id` columns.

**The redundancy**:
```
engagements.intake_id -> intake_applications.contact_id -> contacts  (path 1)
engagements.proposal_id -> proposals.intake_id -> intake_applications.contact_id -> contacts  (path 2)
engagements.contact_id -> contacts  (path 3 — redundant)
proposals.contact_id -> contacts  (path 4 — redundant)
```

**Contradiction risk**: If `proposals.contact_id` is updated independently of `proposals.intake_id -> intake_applications.contact_id`, two paths give different answers for "who is this proposal's client?" The database allows both to coexist.

**Example scenario**:
| Table | contact_id | intake_id -> contact |
|-------|-----------|---------------------|
| proposals #1 | Bob (wrong) | Alice (correct) |

Queries joining through `proposals.contact_id` return Bob. Queries joining through `intake_applications` return Alice.

**Fix options**:
1. Add a trigger to keep `proposals.contact_id` in sync with `intake_applications.contact_id`
2. Replace with a generated/computed column or a view
3. Remove the redundant columns and always join through `intake_id`

---

### 1c. `audit_log` — Polymorphic References with Zero Enforcement

**Location**: `audit_log` table, line 128 in DB.sql

```sql
actor_type text NOT NULL,   -- e.g. 'staff', 'contact', 'system'
actor_id text NOT NULL,     -- uuid stored as TEXT
resource_type text,         -- e.g. 'proposal', 'intake'
resource_id text,           -- uuid stored as TEXT
```

**Problems**:
- **IDs are text, not uuid**: `actor_id = 'not-a-uuid'` inserts fine. Joins with uuid columns require casting, which crashes on invalid data.
- **No referential integrity**: Deleted entities leave dangling audit records. JOINs silently return nulls.
- **No validation on type columns**: No CHECK constraint or enum. Typos like `'staff'` vs `'Staff'` vs `'staff_user'` go undetected.
- **No indexes**: Append-only table with no indexes on `actor_id`, `resource_id`, `action`, or `resource_type`. Full-table-scan on every query.
- **No app code uses this table**: Only appears in the schema dump — suggests the feature was never fully implemented.

**Fix**:
```sql
-- Validate types
ALTER TABLE audit_log ADD CONSTRAINT valid_actor_type
  CHECK (actor_type IN ('staff', 'contact', 'system', 'api_key'));
ALTER TABLE audit_log ADD CONSTRAINT valid_resource_type
  CHECK (resource_type IN ('intake', 'proposal', 'engagement', 'contact', 'payment'));

-- Use uuid type
ALTER TABLE audit_log ALTER COLUMN actor_id TYPE uuid USING actor_id::uuid;
ALTER TABLE audit_log ALTER COLUMN resource_id TYPE uuid USING resource_id::uuid;

-- Add indexes
CREATE INDEX idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

---

### 1d. `firm_rate_tiers` — Orphaned Table, No References

**Location**: `firm_rate_tiers` table, line 267 in DB.sql

```sql
category text NOT NULL,      -- free text, no CHECK, no enum
staff_name text NOT NULL,    -- free text, not a FK to staff_users
hourly_rate numeric NOT NULL,
effective_date date NOT NULL,
superseded_date date,
```

**Problems**:
- `staff_name` is free text — "Jeff Martinez" vs "Jeff martinez" won't match
- `category` has no validation — could be 'attorney', 'Attorney', or 'atty'
- No unique constraint on `(staff_name, category, effective_date)` — allows duplicate rate entries
- No constraint preventing overlapping date ranges for the same person/category
- No FK from or to any other table — completely disconnected
- No app code uses this table — likely an abandoned feature

**Fix**:
```sql
CREATE TABLE public.firm_rate_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES staff_users(id),
  category text NOT NULL CHECK (category IN ('attorney', 'paralegal', 'legal_assistant')),
  hourly_rate numeric NOT NULL CHECK (hourly_rate > 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  superseded_date date,
  CHECK (superseded_date IS NULL OR superseded_date > effective_date),
  CONSTRAINT firm_rate_tiers_pkey PRIMARY KEY (id)
);
```

---

## 2. Two ID Worlds with a Weak Bridge (High Priority)

### Internal (Supabase) vs Filevine IDs

| Domain | ID Type | Example Tables |
|--------|---------|---------------|
| Internal | `uuid` | `contacts`, `intake_applications`, `proposals` |
| Filevine | `bigint` | `fv_projects`, `fv_contacts`, `fv_tasks` |

The only bridge is `fv_entity_xref`:
```sql
fv_entity_type text NOT NULL,  -- e.g. 'contact', 'project'
fv_entity_id text NOT NULL,    -- bigint stored as text
supa_table text,               -- e.g. 'contacts'
supa_id uuid,
```

**Problems**:
- No unique constraint on `(fv_entity_type, fv_entity_id)` — duplicate mappings are possible
- No unique constraint on `(supa_table, supa_id)` — a single Supabase record could map to multiple Filevine entities
- `fv_entity_id` is text while Filevine IDs are bigint — type mismatch
- `lolly_contacts` introduces a third ID system (`lolly_contact_id`) with its own `fv_person_id` mapping — another disconnected bridge
- If `fv_entity_xref` rows are deleted or corrupted, mappings are lost silently

---

## 3. No CASCADE Rules (Medium Priority)

Zero `ON DELETE CASCADE` or `ON UPDATE CASCADE` in the entire schema (267 tables, 375 foreign keys).

If a `contact` is deleted, FK constraints will **block** the delete (good), but there's no defined cleanup path. You'd have to manually delete from `intake_applications`, `payment_plans`, `magic_links`, `portal_sessions`, `push_subscriptions`, etc. in the correct order.

---

## 4. No Explicit Indexes (Medium-High Priority)

The schema has zero explicit `CREATE INDEX` statements. Only PKs and UNIQUE constraints auto-create indexes.

**Missing indexes on frequently-queried FK columns**:
- `intake_applications.contact_id`
- `intake_applications.status`
- `agent_calls.intake_id`
- `proposals.intake_id`
- `proposals.contact_id`
- `engagements.intake_id`
- `payment_transactions.contact_id`
- All `fv_project_id` FK columns across 100+ Filevine tables
- `fv_projects_cache.fts` (tsvector — needs a GIN index to be useful)

---

## 5. Massive Table Duplication (Medium Priority)

### ~80 identical `fv_doclink_*` tables

All follow the same pattern:
```sql
CREATE TABLE fv_doclink_<name> (
  id integer,
  fv_project_id bigint,
  fv_collection_item_id text,
  fv_document_id bigint,
  ...
);
```

Could be a single polymorphic table with a `doclink_type` column. 80 identical schemas means schema changes must be applied 80 times.

### Dual cache/sync tables

Both exist for: `fv_projects`/`fv_projects_cache`, `fv_appointments`/`fv_appointments_cache`, `fv_contacts`/`fv_contacts_cache`, `fv_notes`/`fv_notes_cache`, `fv_tasks`/`fv_tasks_cache`.

Different schemas, different ID types (integer sequence vs uuid), no FK between cache and source. Data can drift between copies.

---

## 6. Boolean Column Explosion on `attorneys` (Low Priority)

~30 individual boolean columns for practice areas and coverage regions (`pa_criminal`, `co_denver_metro`, `wa_king_seattle`, etc.). Adding a new region or practice area requires a schema migration.

Should be a junction table:
```sql
CREATE TABLE attorney_coverage (
  attorney_id uuid REFERENCES attorneys(id),
  coverage_type text NOT NULL,  -- 'practice_area', 'region', 'language'
  coverage_value text NOT NULL, -- 'criminal', 'denver_metro', 'spanish'
  PRIMARY KEY (attorney_id, coverage_type, coverage_value)
);
```

---

## 7. `auth.users` vs `staff_users` vs `contacts` — Three User Tables (Medium Priority)

- `auth.users` — Supabase Auth (referenced by `api_keys`, `automation_rules`, `webhook_endpoints`)
- `staff_users` — internal staff
- `contacts` — clients

No FK between `auth.users` and `staff_users`. A staff member logging in through Supabase Auth has an `auth.users.id` that isn't linked to their `staff_users.id`.

---

## 8. Unstructured `form_data` JSONB (Low Priority)

`intake_applications.form_data` and `form_state` are unstructured JSONB blobs. The Filevine side has fully typed `fv_form_*` tables with explicit columns. The internal intake data doesn't get the same rigor — field names, types, and required fields are invisible to the database.

---

## Priority Summary

| Priority | Issue | Risk |
|----------|-------|------|
| High | `agent_calls.contact_id` missing FK | Phantom references to deleted contacts |
| High | `fv_entity_xref` has no unique constraints | Duplicate/conflicting cross-references |
| High | No indexes on FK columns | Performance degradation at scale |
| High | Two ID worlds with weak bridge | Lost client mappings between systems |
| Medium | Redundant `contact_id` on proposals + engagements | Data contradictions |
| Medium | No CASCADE rules on any FK | Manual cleanup required |
| Medium | `auth.users` not linked to `staff_users` | Identity gap |
| Medium | 80 identical `fv_doclink_*` tables | Schema maintenance burden |
| Low | `audit_log` polymorphic with no validation | Unreliable audit trail |
| Low | `firm_rate_tiers` orphaned | Dead table, no enforcement |
| Low | Boolean explosion on `attorneys` | Inflexible schema |
| Low | Unstructured `form_data` JSONB | No DB-level validation |
