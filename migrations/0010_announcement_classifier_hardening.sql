CREATE TABLE IF NOT EXISTS announcement_candidates (
  id serial PRIMARY KEY,
  source_message_id text NOT NULL,
  source_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  group_id text NOT NULL,
  sender_id text,
  content_hash text NOT NULL,
  original_text text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  candidate_type text NOT NULL DEFAULT 'notice',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending_review',
  confidence double precision NOT NULL DEFAULT 0,
  rule_matched boolean NOT NULL DEFAULT false,
  reasoning_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  extracted_json jsonb,
  detected_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS announcement_candidates_content_hash_idx
  ON announcement_candidates (content_hash);

CREATE INDEX IF NOT EXISTS announcement_candidates_group_detected_idx
  ON announcement_candidates (group_id, detected_at);

CREATE TABLE IF NOT EXISTS classifier_anomalies (
  id serial PRIMARY KEY,
  source_message_id text,
  source_message_ids jsonb,
  anomaly_type text NOT NULL,
  original_title text,
  original_summary text,
  fallback_title text,
  fallback_summary text,
  original_text text,
  payload jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
