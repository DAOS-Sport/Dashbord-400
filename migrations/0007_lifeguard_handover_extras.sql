-- Task #7 救生交接撰寫表單
-- Adds is_important / needs_attention / photo_urls columns to
-- lifeguard_handover_notes so the new HandoverComposer can persist its
-- importance toggles and attached photos. Idempotent so it can run safely
-- on environments where drizzle-kit push has already been applied.

ALTER TABLE lifeguard_handover_notes
  ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_attention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_urls text[];
