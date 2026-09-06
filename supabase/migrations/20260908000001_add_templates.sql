-- Add Production Templates Table
-- Templates for one-click production order dispatch

CREATE TABLE public.production_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  machine_id uuid NOT NULL REFERENCES public.machines(id),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  planned_quantity integer NOT NULL,
  planned_start_time time,
  planned_end_time time,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_active ON public.production_templates(is_active);
CREATE INDEX idx_templates_machine ON public.production_templates(machine_id);

ALTER TABLE public.production_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on production_templates" ON public.production_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_templates TO anon;
GRANT ALL ON public.production_templates TO service_role;

-- Insert sample templates
INSERT INTO public.production_templates (template_name, product_id, machine_id, worker_id, planned_quantity, planned_start_time, planned_end_time, notes)
VALUES
  (
    'รอบเช้า - Product A เครื่อง 01',
    (SELECT id FROM public.products WHERE sku = 'SKU-001'),
    (SELECT id FROM public.machines WHERE machine_code = 'M01'),
    (SELECT id FROM public.workers WHERE employee_id = 'EMP-001'),
    1200,
    '08:00',
    '16:00',
    'งานประจำรอบเช้า'
  ),
  (
    'รอบบ่าย - Product B เครื่อง 02',
    (SELECT id FROM public.products WHERE sku = 'SKU-002'),
    (SELECT id FROM public.machines WHERE machine_code = 'M02'),
    (SELECT id FROM public.workers WHERE employee_id = 'EMP-002'),
    800,
    '16:00',
    '23:00',
    'งานประจำรอบบ่าย'
  ),
  (
    'รอบเช้า - Product C เครื่อง 03',
    (SELECT id FROM public.products WHERE sku = 'SKU-003'),
    (SELECT id FROM public.machines WHERE machine_code = 'M03'),
    (SELECT id FROM public.workers WHERE employee_id = 'EMP-003'),
    1500,
    '08:00',
    '16:00',
    'งานประจำรอบเช้า'
  );
