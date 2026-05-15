CREATE TABLE IF NOT EXISTS line_feature_whitelist (
  id serial PRIMARY KEY,
  line_user_id text NOT NULL UNIQUE,
  employee_number text,
  display_name text NOT NULL,
  phone text,
  department text,
  status text NOT NULL DEFAULT 'active',
  feature_access jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamp,
  ends_at timestamp,
  unlimited boolean NOT NULL DEFAULT true,
  notes text,
  source text NOT NULL DEFAULT 'ragic',
  created_by text,
  created_by_name text,
  updated_by text,
  updated_by_name text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS line_feature_whitelist_line_user_id_idx
  ON line_feature_whitelist (line_user_id);

CREATE INDEX IF NOT EXISTS line_feature_whitelist_status_idx
  ON line_feature_whitelist (status);
