CREATE TABLE IF NOT EXISTS api_monitoring_error_resolutions (
  fingerprint text PRIMARY KEY,
  project_key text NOT NULL,
  route text NOT NULL,
  status_code integer NOT NULL,
  error_type text NOT NULL,
  hour timestamp NOT NULL,
  status text NOT NULL DEFAULT 'open',
  note text,
  resolved_by text,
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_monitoring_error_resolutions_route_hour
  ON api_monitoring_error_resolutions (route, hour DESC);

CREATE INDEX IF NOT EXISTS idx_api_monitoring_error_resolutions_status
  ON api_monitoring_error_resolutions (status);
