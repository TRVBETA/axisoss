-- AXIS V5.1 — Wanderer memory schema
-- Adds two tables for the Wanderer's persistence layer.
-- Single-user system; no RLS policies needed (no public access by design).

CREATE TABLE IF NOT EXISTS wanderer_visits (
    id BIGSERIAL PRIMARY KEY,
    state TEXT NOT NULL,
    zone TEXT NOT NULL,
    line TEXT,
    was_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wanderer_visits_created_at
    ON wanderer_visits (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wanderer_visits_zone
    ON wanderer_visits (zone, created_at DESC);

CREATE TABLE IF NOT EXISTS wanderer_object_touches (
    id BIGSERIAL PRIMARY KEY,
    visit_id BIGINT REFERENCES wanderer_visits(id) ON DELETE CASCADE,
    zone TEXT NOT NULL,
    object_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wanderer_object_touches_visit
    ON wanderer_object_touches (visit_id);

CREATE INDEX IF NOT EXISTS idx_wanderer_object_touches_zone
    ON wanderer_object_touches (zone, object_key, created_at DESC);
