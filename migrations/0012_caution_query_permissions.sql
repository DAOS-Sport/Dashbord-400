CREATE TABLE IF NOT EXISTS caution_query_permissions (
  id serial PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone text,
  department text,
  position text,
  is_active boolean NOT NULL DEFAULT true,
  permission_start_at timestamp,
  permission_end_at timestamp,
  granted_by text NOT NULL,
  granted_at timestamp NOT NULL DEFAULT now(),
  note text,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS caution_query_permissions_user_id_idx
  ON caution_query_permissions (user_id);

CREATE INDEX IF NOT EXISTS idx_caution_permissions_active
  ON caution_query_permissions (is_active, permission_end_at);

CREATE INDEX IF NOT EXISTS idx_caution_permissions_dept
  ON caution_query_permissions (department);

CREATE TABLE IF NOT EXISTS caution_query_permission_audit (
  id serial PRIMARY KEY,
  permission_id integer NOT NULL REFERENCES caution_query_permissions(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'granted', 'enabled', 'disabled', 'period_changed', 'note_changed', 'used'
  )),
  before_state jsonb,
  after_state jsonb,
  actor text NOT NULL,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caution_audit_permission
  ON caution_query_permission_audit (permission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_caution_audit_created
  ON caution_query_permission_audit (created_at DESC);
