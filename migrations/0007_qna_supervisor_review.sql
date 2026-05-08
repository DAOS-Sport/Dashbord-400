ALTER TABLE knowledge_base_qna
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved';

ALTER TABLE knowledge_base_qna
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE knowledge_base_qna
  ADD COLUMN IF NOT EXISTS reviewed_by text;

ALTER TABLE knowledge_base_qna
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp;

UPDATE knowledge_base_qna
SET review_status = 'approved',
    reviewed_at = COALESCE(reviewed_at, updated_at)
WHERE review_status IS NULL OR review_status NOT IN ('pending', 'approved', 'rejected');

CREATE INDEX IF NOT EXISTS knowledge_base_qna_review_status_idx
  ON knowledge_base_qna (facility_key, review_status, updated_at DESC);
