ALTER TABLE notification_hub
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by_user_id text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS created_by_role text;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id serial PRIMARY KEY,
  notification_id integer NOT NULL,
  recipient_user_id text NOT NULL,
  recipient_role text,
  facility_key text,
  read_at timestamp,
  delivered_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_unique
  ON notification_deliveries (notification_id, recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON notification_deliveries (recipient_user_id);
