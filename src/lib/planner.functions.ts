import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ============================================
// Get Master Data for Planner Form
// ============================================

export const getMasterData = createServerFn({ method: "GET" })
  .handler(async () => {
    const [
      { data: products, error: productsError },
      { data: machines, error: machinesError },
      { data: workers, error: workersError },
    ] = await Promise.all([
      supabaseAdmin.from("products").select("*").eq("is_active", true).order("product_name"),
      supabaseAdmin.from("machines").select("*").eq("is_active", true).order("machine_code"),
      supabaseAdmin
        .from("workers")
        .select("*, machines(machine_code, machine_name)")
        .eq("is_active", true)
        .order("full_name"),
    ]);

    if (productsError) throw new Error("Failed to fetch products");
    if (machinesError) throw new Error("Failed to fetch machines");
    if (workersError) throw new Error("Failed to fetch workers");

    return {
      products: products ?? [],
      machines: machines ?? [],
      workers: workers ?? [],
    };
  });

// ============================================
// Get Templates
// ============================================

export const getTemplates = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("production_templates")
      .select(
        `
        *,
        products(sku, product_name, unit),
        machines(machine_code, machine_name),
        workers(full_name, employee_id)
      `
      )
      .eq("is_active", true)
      .order("template_name");

    if (error) throw new Error("Failed to fetch templates");
    return { templates: data ?? [] };
  });

// ============================================
// Create Template
// ============================================

export const createTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: {
    templateName: string;
    productId: string;
    machineId: string;
    workerId: string;
    plannedQuantity: number;
    plannedStartTime?: string;
    plannedEndTime?: string;
    notes?: string;
  }) => {
    if (!data.templateName?.trim()) throw new Error("Template name is required");
    if (!data.productId) throw new Error("Product is required");
    if (!data.machineId) throw new Error("Machine is required");
    if (!data.workerId) throw new Error("Worker is required");
    if (!data.plannedQuantity || data.plannedQuantity <= 0) throw new Error("Quantity must be positive");
    return data;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("production_templates").insert({
      template_name: data.templateName.trim(),
      product_id: data.productId,
      machine_id: data.machineId,
      worker_id: data.workerId,
      planned_quantity: data.plannedQuantity,
      planned_start_time: data.plannedStartTime || null,
      planned_end_time: data.plannedEndTime || null,
      notes: data.notes?.trim() || null,
    });

    if (error) {
      console.error("Failed to create template", error);
      throw new Error("Failed to create template");
    }

    return { ok: true };
  });

// ============================================
// Delete Template (soft delete)
// ============================================

export const deleteTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: { templateId: string }) => {
    if (!data.templateId) throw new Error("Template ID is required");
    return data.templateId;
  })
  .handler(async (templateId: string) => {
    const { error } = await supabaseAdmin
      .from("production_templates")
      .update({ is_active: false })
      .eq("id", templateId);

    if (error) throw new Error("Failed to delete template");
    return { ok: true };
  });

// ============================================
// Get Active Orders (for dashboard view)
// ============================================

export const getActiveOrders = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("production_orders")
      .select(
        `
        *,
        products(sku, product_name, unit),
        machines(machine_code, machine_name),
        workers(full_name, employee_id),
        production_outputs(ok_qty, ng_qty)
      `
      )
      .in("status", ["assigned", "in_progress", "downtime"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error("Failed to fetch active orders");
    return { orders: data ?? [] };
  });

// ============================================
// Get Orders History
// ============================================

export const getOrdersHistory = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("production_orders")
      .select(
        `
        *,
        products(sku, product_name, unit),
        machines(machine_code, machine_name),
        workers(full_name, employee_id),
        production_outputs(ok_qty, ng_qty)
      `
      )
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error("Failed to fetch orders history");
    return { orders: data ?? [] };
  });
