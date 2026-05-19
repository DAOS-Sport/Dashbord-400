BEGIN;

ALTER TABLE knowledge_base_qna
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE lane_rentals
  ADD COLUMN IF NOT EXISTS zone_id text,
  ADD COLUMN IF NOT EXISTS zone_label text,
  ADD COLUMN IF NOT EXISTS start_meter integer,
  ADD COLUMN IF NOT EXISTS end_meter integer;

UPDATE lane_rentals
SET
  zone_label = COALESCE(zone_label, lane_code),
  start_meter = COALESCE(start_meter, 0),
  end_meter = COALESCE(end_meter, 50)
WHERE zone_label IS NULL
   OR start_meter IS NULL
   OR end_meter IS NULL;

ALTER TABLE lane_rentals
  ALTER COLUMN start_meter SET DEFAULT 0,
  ALTER COLUMN start_meter SET NOT NULL,
  ALTER COLUMN end_meter SET DEFAULT 50,
  ALTER COLUMN end_meter SET NOT NULL;

CREATE TABLE IF NOT EXISTS lane_rental_layouts (
  facility_key text PRIMARY KEY,
  pool_length integer NOT NULL DEFAULT 50,
  lane_count integer NOT NULL DEFAULT 6,
  zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

COMMIT;
