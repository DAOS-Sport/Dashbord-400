ALTER TABLE employee_resources
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS event_category text,
  ADD COLUMN IF NOT EXISTS event_start_at timestamp,
  ADD COLUMN IF NOT EXISTS event_end_at timestamp;
