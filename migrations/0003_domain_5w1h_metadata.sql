ALTER TABLE anomaly_reports
  ADD COLUMN IF NOT EXISTS facility_key text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'external-checkin-system',
  ADD COLUMN IF NOT EXISTS received_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_by text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

ALTER TABLE notification_recipients
  ADD COLUMN IF NOT EXISTS facility_key text,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE handover_entries
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE operational_handovers
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS progress_status text,
  ADD COLUMN IF NOT EXISTS progress_percent integer;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS input_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamp;

ALTER TABLE quick_links
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE employee_resources
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

ALTER TABLE system_announcements
  ADD COLUMN IF NOT EXISTS facility_keys jsonb,
  ADD COLUMN IF NOT EXISTS published_by text,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
