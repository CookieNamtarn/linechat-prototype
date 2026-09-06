-- Seed Data for Master Tables
-- Insert sample products, machines, and workers

-- Products
INSERT INTO public.products (sku, product_name, target_per_hour, unit) VALUES
  ('SKU-001', 'Product A - ถุงผ้า 10x15', 500, 'pcs'),
  ('SKU-002', 'Product B - ถุงผ้า 12x18', 400, 'pcs'),
  ('SKU-003', 'Product C - ถุงผ้า 8x12', 600, 'pcs'),
  ('SKU-004', 'Product D - ถุงผ้า 15x20', 300, 'pcs');

-- Machines
INSERT INTO public.machines (machine_code, machine_name, machine_type, location) VALUES
  ('M01', 'เครื่องตีนซอง 01', 'ตีนซอง', 'Line A'),
  ('M02', 'เครื่องตีนซอง 02', 'ตีนซอง', 'Line A'),
  ('M03', 'เครื่องตีนซอง 03', 'ตีนซอง', 'Line B'),
  ('M04', 'เครื่องพิมพ์ 01', 'พิมพ์', 'Line B'),
  ('M05', 'เครื่องตัด 01', 'ตัด', 'Line C');

-- Workers (with LINE User IDs - replace with actual values after testing)
INSERT INTO public.workers (line_user_id, employee_id, full_name, machine_id, shift) VALUES
  ('U1234567890', 'EMP-001', 'สมชาย ใจดี', (SELECT id FROM public.machines WHERE machine_code = 'M01'), 'เช้า'),
  ('U1234567891', 'EMP-002', 'สมศรี รักดี', (SELECT id FROM public.machines WHERE machine_code = 'M02'), 'เช้า'),
  ('U1234567892', 'EMP-003', 'สมหมาย สุขใจ', (SELECT id FROM public.machines WHERE machine_code = 'M03'), 'เช้า'),
  ('U1234567893', 'EMP-004', 'สมหญิง มีสุข', (SELECT id FROM public.machines WHERE machine_code = 'M01'), 'บ่าย'),
  ('U1234567894', 'EMP-005', 'สมบัติ มีทรัพย์', (SELECT id FROM public.machines WHERE machine_code = 'M02'), 'บ่าย');
