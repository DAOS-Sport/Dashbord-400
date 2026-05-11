CREATE TABLE IF NOT EXISTS lifeguard_water_quality_logs (
  id SERIAL PRIMARY KEY,
  facility_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMP,
  source TEXT DEFAULT 'manual' NOT NULL,
  photo_url TEXT NOT NULL,
  photo_key TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  client_address TEXT,
  server_address TEXT,
  client_capture_time TIMESTAMP NOT NULL,
  structured_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_lifeguard_water_quality_facility_date
  ON lifeguard_water_quality_logs(facility_key, created_at DESC);

CREATE TABLE IF NOT EXISTS lifeguard_coach_dive_logs (
  id SERIAL PRIMARY KEY,
  facility_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMP,
  source TEXT DEFAULT 'manual' NOT NULL,
  photo_url TEXT NOT NULL,
  photo_key TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  client_address TEXT,
  server_address TEXT,
  client_capture_time TIMESTAMP NOT NULL,
  structured_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
  correlation_id TEXT,
  coach_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_lifeguard_coach_dive_facility_date
  ON lifeguard_coach_dive_logs(facility_key, created_at DESC);

CREATE TABLE IF NOT EXISTS lifeguard_cleanup_logs (
  id SERIAL PRIMARY KEY,
  facility_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMP,
  source TEXT DEFAULT 'manual' NOT NULL,
  photo_url TEXT NOT NULL,
  photo_key TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  client_address TEXT,
  server_address TEXT,
  client_capture_time TIMESTAMP NOT NULL,
  structured_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_lifeguard_cleanup_facility_date
  ON lifeguard_cleanup_logs(facility_key, created_at DESC);

CREATE TABLE IF NOT EXISTS lifeguard_lost_and_found (
  id SERIAL PRIMARY KEY,
  facility_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMP,
  source TEXT DEFAULT 'manual' NOT NULL,
  photo_url TEXT NOT NULL,
  photo_key TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  client_address TEXT,
  server_address TEXT,
  client_capture_time TIMESTAMP NOT NULL,
  structured_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
  correlation_id TEXT,
  item_category TEXT,
  item_description TEXT NOT NULL,
  found_location_note TEXT,
  claim_status TEXT DEFAULT 'unclaimed' NOT NULL,
  claimed_by_name TEXT,
  claimed_by_contact TEXT,
  claimed_at TIMESTAMP,
  claimed_handler_user_id TEXT,
  claim_note TEXT,
  disposed_at TIMESTAMP,
  disposed_by_user_id TEXT,
  disposed_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_lifeguard_lost_found_facility_date
  ON lifeguard_lost_and_found(facility_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifeguard_lost_found_status
  ON lifeguard_lost_and_found(claim_status, created_at DESC);
