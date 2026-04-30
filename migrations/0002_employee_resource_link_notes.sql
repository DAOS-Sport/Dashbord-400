ALTER TABLE employee_resources
  ADD COLUMN IF NOT EXISTS sub_category text;

ALTER TABLE employee_resources
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

ALTER TABLE employee_resources
  ADD COLUMN IF NOT EXISTS scheduled_at timestamp;
