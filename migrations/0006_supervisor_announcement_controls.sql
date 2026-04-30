ALTER TABLE system_announcements
  ADD COLUMN IF NOT EXISTS announcement_type text NOT NULL DEFAULT 'notice',
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

UPDATE system_announcements
SET announcement_type = CASE
  WHEN severity = 'critical' THEN 'required'
  ELSE 'notice'
END
WHERE announcement_type IS NULL OR announcement_type = '';
