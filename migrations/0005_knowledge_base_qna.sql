CREATE TABLE IF NOT EXISTS knowledge_base_qna (
  id serial PRIMARY KEY,
  facility_key text NOT NULL,
  question text NOT NULL,
  answer text,
  category text,
  tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
  status text DEFAULT 'published' NOT NULL,
  is_pinned boolean DEFAULT false NOT NULL,
  created_by_employee_number text,
  created_by_name text,
  created_by_role text,
  updated_by text,
  source text DEFAULT 'manual' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_base_qna_facility_status_idx
  ON knowledge_base_qna (facility_key, status);

CREATE INDEX IF NOT EXISTS knowledge_base_qna_updated_at_idx
  ON knowledge_base_qna (updated_at DESC);
