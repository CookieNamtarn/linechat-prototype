import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendFlexMessage, sendDowntimeAlert } from "@/lib/line.functions";

// ============================================
// Types
// ============================================

type ProductionOrder = {
  id: string;
  order_number: string;
  product_id: string;
  machine_id: string;
  worker_id: string;
  planned_quantity: number;
  planned_start_time?: string;
  planned_end_time?: string;
  status: "assigned" | "in_progress" | "downtime" | "completed" | "cancelled";
  notes?: string;
  created_by?: string;
};

type CreateOrderInput = {
  orderNumber: string;
  productId: string;
  machineId: string;
  workerId: string;
  plannedQuantity: number;
  plannedStartTime?: string | undefined;
  plannedEndTime?: string | undefined;
  notes?: string | undefined;
  createdBy?: string | undefined;
};

type ProductionEventInput = {
  orderId: string;
  eventType: "start" | "pause" | "resume" | "complete" | "cancel";
  notes?: string | undefined;
};

type RecordOutputInput = {
  orderId: string;
  okQty: number;
  ngQty: number;
  ngReason?: string | undefined;
};

type DowntimeInput = {
  orderId: string;
  reason: "machine_breakdown" | "no_material" | "no_operator" | "quality_issue" | "changeover" | "other";
  reasonDetail?: string | undefined;
};

// ============================================
// Server Function: Create Production Order
// ============================================

export const createProductionOrder = createServerFn({ method: "POST" })
  .inputValidator((data: CreateOrderInput) => {
    if (!data.orderNumber?.trim()) throw new Error("Order number is required");
    if (!data.productId) throw new Error("Product is required");
    if (!data.machineId) throw new Error("Machine is required");
    if (!data.workerId) throw new Error("Worker is required");
    if (!data.plannedQuantity || data.plannedQuantity <= 0) throw new Error("Planned quantity must be positive");
    return {
      orderNumber: data.orderNumber.trim(),
      productId: data.productId,
      machineId: data.machineId,
      workerId: data.workerId,
      plannedQuantity: data.plannedQuantity,
      plannedStartTime: data.plannedStartTime,
      plannedEndTime: data.plannedEndTime,
      notes: data.notes?.trim() || undefined,
      createdBy: data.createdBy,
    };
  })
  .handler(async ({ data }) => {
    // Accept "HH:MM" time-only values from the planner form and turn them
    // into a full timestamp on today's date (Asia/Bangkok, UTC+7).
    const toTimestamp = (value: string | undefined): string | null => {
      if (!value) return null;
      const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
      if (!match) return value;
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const day = now.toISOString().slice(0, 10);
      const hh = match[1]!.padStart(2, "0");
      return `${day}T${hh}:${match[2]}:00+07:00`;
    };

    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    if (!token) throw new Error("LINE Channel access token not configured");

    // 1. Create order in database
    const { data: order, error: orderError } = await supabaseAdmin
      .from("production_orders")
      .insert({
        order_number: data.orderNumber,
        product_id: data.productId,
        machine_id: data.machineId,
        worker_id: data.workerId,
        planned_quantity: data.plannedQuantity,
        planned_start_time: toTimestamp(data.plannedStartTime),
        planned_end_time: toTimestamp(data.plannedEndTime),
        status: "assigned",
        notes: data.notes ?? null,
        created_by: data.createdBy ?? null,
      })
      .select("*")
      .single();

    if (orderError || !order) {
      console.error("Failed to create production order", orderError);
      throw new Error("Failed to create production order");
    }

    // 2. Get worker's LINE user ID
    const { data: worker } = await supabaseAdmin
      .from("workers")
      .select("line_user_id, full_name")
      .eq("id", data.workerId)
      .single();

    // 3. Get product and machine info for the Flex Message
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("product_name")
      .eq("id", data.productId)
      .single();

    const { data: machine } = await supabaseAdmin
      .from("machines")
      .select("machine_name")
      .eq("id", data.machineId)
      .single();

    // 4. Build and send Flex Message to worker
    if (worker?.line_user_id && product && machine) {
      const flexMessage = buildAssignedFlexMessage({
        orderId: order.id,
        orderNumber: order.order_number,
        productName: product.product_name,
        machineName: machine.machine_name,
        plannedQuantity: data.plannedQuantity,
        plannedStartTime: data.plannedStartTime,
        plannedEndTime: data.plannedEndTime,
      });

      await sendFlexMessage(worker.line_user_id, flexMessage);
    }

    return { ok: true, orderId: order.id };
  });

// ============================================
// Server Function: Handle Production Action
// ============================================

export const handleProductionAction = createServerFn({ method: "POST" })
  .inputValidator((data: ProductionEventInput) => {
    if (!data.orderId) throw new Error("Order ID is required");
    if (!data.eventType) throw new Error("Event type is required");
    const validTypes = ["start", "pause", "resume", "complete", "cancel"];
    if (!validTypes.includes(data.eventType)) throw new Error("Invalid event type");
    return data;
  })
  .handler(async ({ data }) => {
    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    if (!token) throw new Error("LINE Channel access token not configured");

    const now = new Date().toISOString();

    // 1. Insert production event
    const { error: eventError } = await supabaseAdmin
      .from("production_events")
      .insert({
        order_id: data.orderId,
        event_type: data.eventType,
        event_time: now,
        notes: data.notes ?? null,
      });

    if (eventError) {
      console.error("Failed to insert production event", eventError);
      throw new Error("Failed to record production event");
    }

    // 2. Determine new status based on event
    const statusMap: Record<string, ProductionOrder["status"]> = {
      start: "in_progress",
      pause: "downtime",
      resume: "in_progress",
      complete: "completed",
      cancel: "cancelled",
    };

    const newStatus = statusMap[data.eventType];
    if (!newStatus) throw new Error("Invalid event type");

    // 3. Update order status
    const { data: order, error: updateError } = await supabaseAdmin
      .from("production_orders")
      .update({ status: newStatus, updated_at: now })
      .eq("id", data.orderId)
      .select("*")
      .single();

    if (updateError || !order) {
      console.error("Failed to update order status", updateError);
      throw new Error("Failed to update order status");
    }

    // 4. Get worker's LINE user ID for Flex Message update
    const { data: worker } = await supabaseAdmin
      .from("workers")
      .select("line_user_id, full_name")
      .eq("id", order.worker_id)
      .single();

    if (!worker?.line_user_id) {
      return { ok: true, status: newStatus, warning: "Worker LINE ID not found" };
    }

    // 5. Get product and machine info
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("product_name")
      .eq("id", order.product_id)
      .single();

    const { data: machine } = await supabaseAdmin
      .from("machines")
      .select("machine_name")
      .eq("id", order.machine_id)
      .single();

    // 6. Send appropriate Flex Message based on new state
    if (product && machine) {
      const flexMessage = buildStateFlexMessage({
        orderId: order.id,
        orderNumber: order.order_number,
        productName: product.product_name,
        machineName: machine.machine_name,
        plannedQuantity: order.planned_quantity,
        status: newStatus,
      });

      await sendFlexMessage(worker.line_user_id, flexMessage);
    }

    return { ok: true, status: newStatus };
  });

// ============================================
// Server Function: Record Output
// ============================================

export const recordOutput = createServerFn({ method: "POST" })
  .inputValidator((data: RecordOutputInput) => {
    if (!data.orderId) throw new Error("Order ID is required");
    if (data.okQty < 0) throw new Error("OK quantity cannot be negative");
    if (data.ngQty < 0) throw new Error("NG quantity cannot be negative");
    if (data.okQty + data.ngQty === 0) throw new Error("Total quantity must be greater than 0");
    return data;
  })
  .handler(async ({ data }) => {
    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    if (!token) throw new Error("LINE Channel access token not configured");

    const now = new Date().toISOString();

    // 1. Record output
    const { error: outputError } = await supabaseAdmin
      .from("production_outputs")
      .insert({
        order_id: data.orderId,
        ok_qty: data.okQty,
        ng_qty: data.ngQty,
        ng_reason: data.ngReason ?? null,
      });

    if (outputError) {
      console.error("Failed to record output", outputError);
      throw new Error("Failed to record output");
    }

    // 2. Mark event as complete
    await supabaseAdmin
      .from("production_events")
      .insert({
        order_id: data.orderId,
        event_type: "complete",
        event_time: now,
      });

    // 3. Update order status to completed
    const { data: order } = await supabaseAdmin
      .from("production_orders")
      .update({ status: "completed", updated_at: now })
      .eq("id", data.orderId)
      .select("*")
      .single();

    // 4. Send completion Flex Message
    if (order) {
      const { data: worker } = await supabaseAdmin
        .from("workers")
        .select("line_user_id, full_name")
        .eq("id", order.worker_id)
        .single();

      const { data: product } = await supabaseAdmin
        .from("products")
        .select("product_name")
        .eq("id", order.product_id)
        .single();

      const { data: machine } = await supabaseAdmin
        .from("machines")
        .select("machine_name")
        .eq("id", order.machine_id)
        .single();

      const { data: lastEvent } = await supabaseAdmin
        .from("production_events")
        .select("event_time")
        .eq("order_id", data.orderId)
        .eq("event_type", "start")
        .single();

      if (worker?.line_user_id && product && machine && lastEvent) {
        const startTime = new Date(lastEvent.event_time);
        const endTime = new Date(now);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = Math.floor(durationMs / 3600000);
        const durationMins = Math.floor((durationMs % 3600000) / 60000);
        const durationSecs = Math.floor((durationMs % 60000) / 1000);
        const durationStr = `${durationHours}:${durationMins.toString().padStart(2, "0")}:${durationSecs.toString().padStart(2, "0")}`;

        const yieldPct = ((data.okQty / (data.okQty + data.ngQty)) * 100).toFixed(1);

        const flexMessage = buildCompletedFlexMessage({
          orderId: order.id,
          orderNumber: order.order_number,
          productName: product.product_name,
          machineName: machine.machine_name,
          plannedQuantity: order.planned_quantity,
          startTime: startTime.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          endTime: endTime.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          duration: durationStr,
          okQty: data.okQty,
          ngQty: data.ngQty,
          yield: yieldPct,
        });

        await sendFlexMessage(worker.line_user_id, flexMessage);
      }
    }

    return { ok: true };
  });

// ============================================
// Server Function: Report Downtime
// ============================================

export const reportDowntime = createServerFn({ method: "POST" })
  .inputValidator((data: DowntimeInput) => {
    if (!data.orderId) throw new Error("Order ID is required");
    if (!data.reason) throw new Error("Reason is required");
    const validReasons = ["machine_breakdown", "no_material", "no_operator", "quality_issue", "changeover", "other"];
    if (!validReasons.includes(data.reason)) throw new Error("Invalid reason");
    return data;
  })
  .handler(async ({ data }) => {
    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    if (!token) throw new Error("LINE Channel access token not configured");

    const now = new Date().toISOString();

    // 1. Record downtime log
    const { data: downtime, error: downtimeError } = await supabaseAdmin
      .from("downtime_logs")
      .insert({
        order_id: data.orderId,
        reason: data.reason,
        reason_detail: data.reasonDetail ?? null,
        start_time: now,
      })
      .select("*")
      .single();

    if (downtimeError || !downtime) {
      console.error("Failed to create downtime log", downtimeError);
      throw new Error("Failed to record downtime");
    }

    // 2. Insert production event (pause)
    await supabaseAdmin
      .from("production_events")
      .insert({
        order_id: data.orderId,
        event_type: "pause",
        event_time: now,
      });

    // 3. Update order status
    const { data: order } = await supabaseAdmin
      .from("production_orders")
      .update({ status: "downtime", updated_at: now })
      .eq("id", data.orderId)
      .select("*")
      .single();

    // 4. Send admin group alert
    if (order) {
      const { data: worker } = await supabaseAdmin
        .from("workers")
        .select("full_name")
        .eq("id", order.worker_id)
        .single();

      const { data: product } = await supabaseAdmin
        .from("products")
        .select("product_name")
        .eq("id", order.product_id)
        .single();

      const { data: machine } = await supabaseAdmin
        .from("machines")
        .select("machine_name")
        .eq("id", order.machine_id)
        .single();

      const reasonLabels: Record<string, string> = {
        machine_breakdown: "เครื่องเสีย (Breakdown)",
        no_material: "รอวัตถุดิบ (No Material)",
        no_operator: "รอคน (No Operator)",
        quality_issue: "ปัญหาคุณภาพ",
        changeover: "เปลี่ยนงาน (Changeover)",
        other: "อื่นๆ",
      };

      await sendDowntimeAlert({
        machineName: machine?.machine_name || "Unknown",
        productName: product?.product_name || "Unknown",
        workerName: worker?.full_name || "Unknown",
        reason: reasonLabels[data.reason] || data.reason,
        ...(data.reasonDetail ? { reasonDetail: data.reasonDetail } : {}),
        time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        orderNumber: order.order_number,
      });

      // 5. Update worker's Flex Message to downtime state
      const { data: workerFull } = await supabaseAdmin
        .from("workers")
        .select("line_user_id")
        .eq("id", order.worker_id)
        .single();

      if (workerFull?.line_user_id && product && machine) {
        const flexMessage = buildDowntimeFlexMessage({
          orderId: order.id,
          orderNumber: order.order_number,
          productName: product.product_name,
          machineName: machine.machine_name,
          reason: reasonLabels[data.reason] || data.reason,
          startTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        });

        await sendFlexMessage(workerFull.line_user_id, flexMessage);
      }
    }

    return { ok: true };
  });

// ============================================
// Server Function: Resume Production
// ============================================

export const resumeProduction = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string }) => {
    if (!data.orderId) throw new Error("Order ID is required");
    return data.orderId;
  })
  .handler(async ({ data: orderId }) => {
    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    if (!token) throw new Error("LINE Channel access token not configured");

    const now = new Date().toISOString();

    // 1. Close the active downtime log
    const { data: activeDowntime } = await supabaseAdmin
      .from("downtime_logs")
      .select("*")
      .eq("order_id", orderId)
      .is("end_time", null)
      .single();

    if (activeDowntime) {
      const startTime = new Date(activeDowntime.start_time).getTime();
      const endTime = new Date(now).getTime();
      const durationMinutes = Math.round((endTime - startTime) / 60000);

      await supabaseAdmin
        .from("downtime_logs")
        .update({
          end_time: now,
          duration_minutes: durationMinutes,
        })
        .eq("id", activeDowntime.id);
    }

    // 2. Insert resume event
    await supabaseAdmin
      .from("production_events")
      .insert({
        order_id: orderId,
        event_type: "resume",
        event_time: now,
      });

    // 3. Update order status
    await supabaseAdmin
      .from("production_orders")
      .update({ status: "in_progress", updated_at: now })
      .eq("id", orderId);

    // 4. Send updated Flex Message to worker
    const { data: order } = await supabaseAdmin
      .from("production_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (order) {
      const { data: worker } = await supabaseAdmin
        .from("workers")
        .select("line_user_id")
        .eq("id", order.worker_id)
        .single();

      const { data: product } = await supabaseAdmin
        .from("products")
        .select("product_name")
        .eq("id", order.product_id)
        .single();

      const { data: machine } = await supabaseAdmin
        .from("machines")
        .select("machine_name")
        .eq("id", order.machine_id)
        .single();

      if (worker?.line_user_id && product && machine) {
        const { data: startEvent } = await supabaseAdmin
          .from("production_events")
          .select("event_time")
          .eq("order_id", orderId)
          .eq("event_type", "start")
          .single();

        const startTime = startEvent ? new Date(startEvent.event_time) : new Date();
        const elapsed = new Date().getTime() - startTime.getTime();
        const hours = Math.floor(elapsed / 3600000);
        const mins = Math.floor((elapsed % 3600000) / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        const elapsedStr = `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

        const flexMessage = buildInProgressFlexMessage({
          orderId: order.id,
          orderNumber: order.order_number,
          productName: product.product_name,
          machineName: machine.machine_name,
          plannedQuantity: order.planned_quantity,
          startTime: startTime.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          elapsedTime: elapsedStr,
        });

        await sendFlexMessage(worker.line_user_id, flexMessage);
      }
    }

    return { ok: true };
  });

// ============================================
// Flex Message Builders
// ============================================

type FlexMessageData = {
  orderId: string;
  orderNumber: string;
  productName: string;
  machineName: string;
  plannedQuantity: number;
  plannedStartTime?: string | undefined;
  plannedEndTime?: string | undefined;
};

function buildAssignedFlexMessage(data: FlexMessageData) {
  const liffId = process.env["LINE_LIFF_ID"] || "{LIFF_ID}";
  return {
    type: "flex",
    altText: `คำสั่งผลิตใหม่: ${data.productName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📋 คำสั่งผลิตใหม่",
            weight: "bold",
            size: "lg",
            color: "#1A73E8",
          },
        ],
        backgroundColor: "#E8F0FE",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "Order", size: "xs", color: "#666666" },
              { type: "text", text: data.orderNumber, weight: "bold", size: "sm" },
            ],
            margin: "md",
          },
          {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "สินค้า", size: "xs", color: "#666666" },
              { type: "text", text: data.productName, weight: "bold", size: "md" },
            ],
            margin: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "จำนวน", size: "xs", color: "#666666" },
                  { type: "text", text: `${data.plannedQuantity.toLocaleString()} pcs`, weight: "bold" },
                ],
                flex: 1,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เครื่อง", size: "xs", color: "#666666" },
                  { type: "text", text: data.machineName, weight: "bold" },
                ],
                flex: 1,
              },
            ],
            margin: "sm",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: "กดปุ่มเพื่อเริ่มผลิต",
            size: "sm",
            color: "#666666",
            align: "center",
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "postback",
              label: "▶️ เริ่มผลิต",
              data: `action=start&order_id=${data.orderId}`,
              displayText: "เริ่มผลิต",
            },
            style: "primary",
            color: "#06C755",
          },
          {
            type: "button",
            action: {
              type: "uri",
              label: "⚠️ แจ้งปัญหา",
              uri: `https://liff.line.me/${liffId}/downtime?order_id=${data.orderId}`,
            },
            style: "secondary",
            margin: "md",
          },
        ],
      },
    },
  };
}

function buildStateFlexMessage(data: FlexMessageData & { status: ProductionOrder["status"] }) {
  switch (data.status) {
    case "in_progress":
      return buildInProgressFlexMessage({
        ...data,
        startTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        elapsedTime: "0:00:00",
      });
    case "completed":
      return buildCompletedFlexMessage({
        ...data,
        startTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        endTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        duration: "0:00:00",
        okQty: 0,
        ngQty: 0,
        yield: "0",
      });
    case "downtime":
      return buildDowntimeFlexMessage({
        ...data,
        reason: "Unknown",
        startTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      });
    default:
      return buildAssignedFlexMessage(data);
  }
}

function buildInProgressFlexMessage(data: {
  orderId: string;
  orderNumber: string;
  productName: string;
  machineName: string;
  plannedQuantity: number;
  startTime: string;
  elapsedTime: string;
}) {
  const liffId = process.env["LINE_LIFF_ID"] || "{LIFF_ID}";
  return {
    type: "flex",
    altText: `กำลังผลิต: ${data.productName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🔄 กำลังผลิต",
            weight: "bold",
            size: "lg",
            color: "#FFFFFF",
          },
        ],
        backgroundColor: "#1A73E8",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "สินค้า", size: "xs", color: "#666666" },
              { type: "text", text: data.productName, weight: "bold", size: "md" },
            ],
            margin: "md",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "จำนวน", size: "xs", color: "#666666" },
                  { type: "text", text: `${data.plannedQuantity.toLocaleString()} pcs`, weight: "bold" },
                ],
                flex: 1,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เครื่อง", size: "xs", color: "#666666" },
                  { type: "text", text: data.machineName, weight: "bold" },
                ],
                flex: 1,
              },
            ],
            margin: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เวลาเริ่ม", size: "xs", color: "#666666" },
                  { type: "text", text: data.startTime, weight: "bold", color: "#06C755" },
                ],
                flex: 1,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เวลาผ่านไป", size: "xs", color: "#666666" },
                  { type: "text", text: data.elapsedTime, weight: "bold", color: "#1A73E8" },
                ],
                flex: 1,
              },
            ],
            margin: "sm",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: "กดปุ่มเมื่อผลิตเสร็จ",
            size: "sm",
            color: "#666666",
            align: "center",
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "✅ ผลิตเสร็จสิ้น",
              uri: `https://liff.line.me/${liffId}/complete?order_id=${data.orderId}`,
            },
            style: "primary",
            color: "#06C755",
          },
          {
            type: "button",
            action: {
              type: "uri",
              label: "⚠️ แจ้งปัญหา",
              uri: `https://liff.line.me/${liffId}/downtime?order_id=${data.orderId}`,
            },
            style: "secondary",
            margin: "md",
          },
        ],
      },
    },
  };
}

function buildCompletedFlexMessage(data: {
  orderId: string;
  orderNumber: string;
  productName: string;
  machineName: string;
  plannedQuantity: number;
  startTime: string;
  endTime: string;
  duration: string;
  okQty: number;
  ngQty: number;
  yield: string;
}) {
  return {
    type: "flex",
    altText: `ผลิตเสร็จแล้ว: ${data.productName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "✅ ผลิตเสร็จสิ้น",
            weight: "bold",
            size: "lg",
            color: "#FFFFFF",
          },
        ],
        backgroundColor: "#06C755",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "สินค้า", size: "xs", color: "#666666" },
              { type: "text", text: data.productName, weight: "bold", size: "md" },
            ],
            margin: "md",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เวลาเริ่ม", size: "xs", color: "#666666" },
                  { type: "text", text: data.startTime },
                ],
                flex: 1,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เวลาจบ", size: "xs", color: "#666666" },
                  { type: "text", text: data.endTime },
                ],
                flex: 1,
              },
            ],
            margin: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "รวมเวลา", size: "xs", color: "#666666" },
                  { type: "text", text: data.duration },
                ],
                flex: 1,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "จำนวน", size: "xs", color: "#666666" },
                  { type: "text", text: `${data.plannedQuantity.toLocaleString()} pcs` },
                ],
                flex: 1,
              },
            ],
            margin: "sm",
          },
          {
            type: "separator",
            margin: "md",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "OK", size: "xs", color: "#666666" },
                  { type: "text", text: data.okQty.toLocaleString(), weight: "bold", size: "lg", color: "#06C755" },
                ],
                flex: 1,
                alignItems: "center",
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "NG", size: "xs", color: "#666666" },
                  { type: "text", text: data.ngQty.toLocaleString(), weight: "bold", size: "lg", color: "#EA4335" },
                ],
                flex: 1,
                alignItems: "center",
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "Yield", size: "xs", color: "#666666" },
                  { type: "text", text: `${data.yield}%`, weight: "bold", size: "lg", color: "#1A73E8" },
                ],
                flex: 1,
                alignItems: "center",
              },
            ],
            margin: "md",
          },
        ],
      },
    },
  };
}

function buildDowntimeFlexMessage(data: {
  orderId: string;
  orderNumber: string;
  productName: string;
  machineName: string;
  reason: string;
  startTime: string;
}) {
  return {
    type: "flex",
    altText: `หยุดผลิตชั่วคราว: ${data.productName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "⚠️ หยุดผลิตชั่วคราว",
            weight: "bold",
            size: "lg",
            color: "#FFFFFF",
          },
        ],
        backgroundColor: "#EA4335",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "สินค้า", size: "xs", color: "#666666" },
              { type: "text", text: data.productName, weight: "bold", size: "md" },
            ],
            margin: "md",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เครื่อง", size: "xs", color: "#666666" },
                  { type: "text", text: data.machineName },
                ],
                flex: 1,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "สาเหตุ", size: "xs", color: "#666666" },
                  { type: "text", text: data.reason, weight: "bold", color: "#EA4335" },
                ],
                flex: 1,
              },
            ],
            margin: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "เวลาเริ่ม Downtime", size: "xs", color: "#666666" },
                  { type: "text", text: data.startTime, weight: "bold" },
                ],
                flex: 1,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "ระยะเวลา", size: "xs", color: "#666666" },
                  { type: "text", text: "กำลังนับ...", weight: "bold", color: "#EA4335" },
                ],
                flex: 1,
              },
            ],
            margin: "sm",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: "ระบบได้แจ้งเตือนทีม Maintenance แล้ว",
            size: "sm",
            color: "#666666",
            align: "center",
            margin: "md",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "postback",
              label: "🔄 กลับมาผลิตต่อ",
              data: `action=resume&order_id=${data.orderId}`,
              displayText: "กลับมาผลิตต่อ",
            },
            style: "primary",
            color: "#06C755",
          },
        ],
      },
    },
  };
}
