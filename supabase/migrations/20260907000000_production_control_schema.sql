-- Production Control System Schema
-- Migration: Add production orders, events, downtime, machines, workers, products

-- ============================================
-- Master Data Tables
-- ============================================

CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_code text NOT NULL UNIQUE,
  machine_name text NOT NULL,
  machine_type text,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  product_name text NOT NULL,
  target_per_hour integer,
  unit text DEFAULT 'pcs',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text NOT NULL UNIQUE,
  employee_id text,
  full_name text NOT NULL,
  machine_id uuid REFERENCES public.machines(id),
  shift text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Production Order & Event Tables
-- ============================================

CREATE TYPE public.order_status AS ENUM (
  'assigned',
  'in_progress',
  'downtime',
  'completed',
  'cancelled'
);

CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  machine_id uuid NOT NULL REFERENCES public.machines(id),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  planned_quantity integer NOT NULL,
  planned_start_time timestamptz,
  planned_end_time timestamptz,
  status public.order_status NOT NULL DEFAULT 'assigned',
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.event_type AS ENUM (
  'start',
  'pause',
  'resume',
  'complete',
  'cancel'
);

CREATE TABLE public.production_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  event_type public.event_type NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  recorded_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.production_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  ok_qty integer NOT NULL DEFAULT 0,
  ng_qty integer NOT NULL DEFAULT 0,
  ng_reason text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Downtime Tables
-- ============================================

CREATE TYPE public.downtime_reason AS ENUM (
  'machine_breakdown',
  'no_material',
  'no_operator',
  'quality_issue',
  'changeover',
  'other'
);

CREATE TABLE public.downtime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  reason public.downtime_reason NOT NULL,
  reason_detail text,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_minutes integer,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.downtime_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  downtime_id uuid NOT NULL REFERENCES public.downtime_logs(id) ON DELETE CASCADE,
  alert_sent_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  reminder_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_production_orders_status ON public.production_orders(status);
CREATE INDEX idx_production_orders_worker ON public.production_orders(worker_id);
CREATE INDEX idx_production_orders_machine ON public.production_orders(machine_id);
CREATE INDEX idx_production_orders_created ON public.production_orders(created_at DESC);
CREATE INDEX idx_production_events_order ON public.production_events(order_id, event_time);
CREATE INDEX idx_downtime_logs_order ON public.downtime_logs(order_id);
CREATE INDEX idx_downtime_logs_active ON public.downtime_logs(end_time) WHERE end_time IS NULL;
CREATE INDEX idx_workers_line_user ON public.workers(line_user_id);
CREATE INDEX idx_workers_machine ON public.workers(machine_id);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtime_alerts ENABLE ROW LEVEL SECURITY;

-- Allow all for anon/authenticated (adjust for production)
CREATE POLICY "Allow all on machines" ON public.machines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on workers" ON public.workers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on production_orders" ON public.production_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on production_events" ON public.production_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on production_outputs" ON public.production_outputs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on downtime_logs" ON public.downtime_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on downtime_alerts" ON public.downtime_alerts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================
-- Grants
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_outputs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downtime_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downtime_alerts TO anon;

GRANT ALL ON public.machines TO service_role;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.workers TO service_role;
GRANT ALL ON public.production_orders TO service_role;
GRANT ALL ON public.production_events TO service_role;
GRANT ALL ON public.production_outputs TO service_role;
GRANT ALL ON public.downtime_logs TO service_role;
GRANT ALL ON public.downtime_alerts TO service_role;

-- ============================================
-- Realtime Publication
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.production_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.downtime_logs;
