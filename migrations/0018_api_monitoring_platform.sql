CREATE TABLE IF NOT EXISTS bff_latency_logs (
  id serial PRIMARY KEY,
  timestamp timestamp NOT NULL DEFAULT now(),
  route text NOT NULL,
  role text,
  facility_key text,
  duration_ms integer NOT NULL,
  status_code integer NOT NULL,
  correlation_id text
);

CREATE TABLE IF NOT EXISTS integration_error_logs (
  id serial PRIMARY KEY,
  timestamp timestamp NOT NULL DEFAULT now(),
  source text NOT NULL,
  error_code text NOT NULL,
  message text NOT NULL,
  payload jsonb,
  correlation_id text
);

CREATE INDEX IF NOT EXISTS idx_bff_latency_logs_route_timestamp
  ON bff_latency_logs (route, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_bff_latency_logs_status_timestamp
  ON bff_latency_logs (status_code, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_integration_error_logs_timestamp
  ON integration_error_logs (timestamp DESC);
