-- Migration 0013: group_broadcasts table
-- Creates the group_broadcasts table for the 群組重要公告 module.
-- If the table was already created via direct SQL during development, this migration
-- is idempotent (all statements use IF NOT EXISTS / IF EXISTS guards).

CREATE TABLE IF NOT EXISTS group_broadcasts (
  id                  serial       PRIMARY KEY,
  source_group_id     text,
  source_facility_key text         NOT NULL,
  target_facility_keys text[]      NOT NULL DEFAULT '{}',
  original_text       text         NOT NULL,
  title               text,
  summary             text,
  priority            text         NOT NULL DEFAULT 'normal',
  sender_name         text,
  gemini_status       text         NOT NULL DEFAULT 'pending',
  is_event            boolean,
  start_at            timestamp,
  end_at              timestamp,
  gemini_processed_at timestamp,
  candidate_id        integer,
  deleted_at          timestamp,
  created_at          timestamp    NOT NULL DEFAULT NOW(),
  updated_at          timestamp    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_broadcasts_source_facility_idx ON group_broadcasts(source_facility_key);
CREATE INDEX IF NOT EXISTS group_broadcasts_created_at_idx      ON group_broadcasts(created_at);
CREATE INDEX IF NOT EXISTS group_broadcasts_source_group_idx    ON group_broadcasts(source_group_id);

-- Ensure deleted_at column exists (for deployments upgraded from an earlier dev version)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_broadcasts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE group_broadcasts ADD COLUMN deleted_at timestamp;
  END IF;
END$$;
