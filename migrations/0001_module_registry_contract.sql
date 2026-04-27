CREATE TABLE IF NOT EXISTS module_settings (
  module_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  stage text NOT NULL,
  menu_order integer NOT NULL DEFAULT 100,
  card_order integer,
  config_json jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_role_permissions (
  id serial PRIMARY KEY,
  module_id text NOT NULL,
  role text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS module_role_permissions_module_role_idx
  ON module_role_permissions (module_id, role);

CREATE TABLE IF NOT EXISTS module_facility_overrides (
  id serial PRIMARY KEY,
  facility_key text NOT NULL,
  module_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  config_json jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS module_facility_overrides_facility_module_idx
  ON module_facility_overrides (facility_key, module_id);

CREATE TABLE IF NOT EXISTS ui_events (
  id serial PRIMARY KEY,
  event_type text,
  module_id text,
  user_id text,
  role text,
  facility_key text,
  route_path text,
  metadata jsonb,
  occurred_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE ui_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE ui_events ADD COLUMN IF NOT EXISTS module_id text;
ALTER TABLE ui_events ADD COLUMN IF NOT EXISTS route_path text;
ALTER TABLE ui_events ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE ui_events ADD COLUMN IF NOT EXISTS occurred_at timestamp;
ALTER TABLE ui_events ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS client_errors (
  id serial PRIMARY KEY,
  user_id text,
  role text,
  facility_key text,
  route_path text,
  message text NOT NULL,
  stack text,
  metadata jsonb,
  occurred_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);
