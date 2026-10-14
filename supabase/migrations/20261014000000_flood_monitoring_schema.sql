-- ====================================================================
-- OPLAN PA-ANDAM: A Resilient Multi-Protocol IoT Framework
-- PostgreSQL Database Schema & Row Level Security (RLS) Setup
-- Aklan State University - Ibajay Campus
-- ====================================================================

-- 1. Create Extension for UUID generation if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Table: flood_nodes
CREATE TABLE IF NOT EXISTS public.flood_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_code TEXT NOT NULL UNIQUE,
    node_name TEXT NOT NULL,
    description TEXT,
    location_description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on node_code
CREATE INDEX IF NOT EXISTS idx_flood_nodes_code ON public.flood_nodes(node_code);

-- 3. Table: flood_readings
CREATE TABLE IF NOT EXISTS public.flood_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES public.flood_nodes(id) ON DELETE CASCADE,
    water_level NUMERIC NOT NULL,
    distance_cm NUMERIC NOT NULL,
    flood_status TEXT NOT NULL CHECK (flood_status IN ('NORMAL', 'WARNING', 'CRITICAL', 'NO DATA')),
    sequence_number BIGINT NOT NULL,
    rssi NUMERIC,
    snr NUMERIC,
    sensor_online BOOLEAN NOT NULL DEFAULT true,
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flood_readings_node_id ON public.flood_readings(node_id);
CREATE INDEX IF NOT EXISTS idx_flood_readings_received_at ON public.flood_readings(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_flood_readings_node_received ON public.flood_readings(node_id, received_at DESC);

-- 4. Table: flood_events
CREATE TABLE IF NOT EXISTS public.flood_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES public.flood_nodes(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL CHECK (new_status IN ('NORMAL', 'WARNING', 'CRITICAL', 'NO DATA')),
    water_level NUMERIC,
    event_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,
    notes TEXT
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_flood_events_node_id ON public.flood_events(node_id);
CREATE INDEX IF NOT EXISTS idx_flood_events_event_time ON public.flood_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_flood_events_ack ON public.flood_events(acknowledged);

-- 5. Table: flood_settings
CREATE TABLE IF NOT EXISTS public.flood_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    green_threshold NUMERIC NOT NULL DEFAULT 20.0,
    warning_threshold NUMERIC NOT NULL DEFAULT 50.0,
    critical_threshold NUMERIC NOT NULL DEFAULT 80.0,
    offline_timeout_seconds INTEGER NOT NULL DEFAULT 120,
    display_water_level_unit TEXT NOT NULL DEFAULT 'cm',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.flood_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_settings ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Public Read-Only for Monitoring Dashboard
-- Anyone (authenticated or anonymous) can view the current telemetry and active nodes
CREATE POLICY "Public Read Access: flood_nodes"
    ON public.flood_nodes FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public Read Access: flood_readings"
    ON public.flood_readings FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public Read Access: flood_events"
    ON public.flood_events FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public Read Access: flood_settings"
    ON public.flood_settings FOR SELECT
    TO anon, authenticated
    USING (true);

-- 8. RLS Policies: Administrator & Service-Role Mutation Access
-- Only authenticated users or the Supabase Edge Function (via Service Role) can insert readings
CREATE POLICY "Service Role Full Access: flood_readings"
    ON public.flood_readings FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admin Node Management: flood_nodes"
    ON public.flood_nodes FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admin Event Acknowledgment: flood_events"
    ON public.flood_events FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admin Settings Calibration: flood_settings"
    ON public.flood_settings FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 9. Realtime Publication Setup
-- Enable Supabase Realtime for live dashboard widgets
ALTER PUBLICATION supabase_realtime ADD TABLE public.flood_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flood_events;

-- 10. Initial Seed Data: Register Node PA-ANDAM-001 & Default Settings
INSERT INTO public.flood_nodes (node_code, node_name, description, location_description, enabled)
VALUES (
    'PA-ANDAM-001',
    'ASU-Ibajay Riverside Station 1',
    'JSN-SR04T ultrasonic flood monitoring station with 433MHz RA-02 LoRa link',
    'Ibajay River Embankment, ASU-Ibajay Campus (Near Agribusiness Center)',
    true
)
ON CONFLICT (node_code) DO NOTHING;

INSERT INTO public.flood_settings (green_threshold, warning_threshold, critical_threshold, offline_timeout_seconds, display_water_level_unit)
VALUES (20.0, 50.0, 80.0, 120, 'cm')
ON CONFLICT DO NOTHING;
