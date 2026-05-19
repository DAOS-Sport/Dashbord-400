CREATE TABLE IF NOT EXISTS user_workbench_preferences (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  role text NOT NULL,
  preference_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_workbench_preferences_unique
  ON user_workbench_preferences (user_id, role, preference_key);
