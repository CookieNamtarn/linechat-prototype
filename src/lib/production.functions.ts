import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    const toTimestamp = (value: string | undefined): string | null => {
      if (!value) return null;
      const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
      if (!match) return value;
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const day = now.toISOString().slice(0, 10);
      const hh = match[1]!.padStart(2, "0");
      return `${day}T${hh}:${match[2]}:00+07:00`;
    };

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

    // 2. Get worker info
    const { data: worker } = await supabaseAdmin
      .from("workers")
      .select("telegram_chat_id, full_name")
      .eq("id", data.workerId)
      .single();

    // 3. Get product and machine info
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

    // 4. Send plain text message to worker
    if (worker?.telegram_chat_id && product && machine) {
      const msg = buildAssignedMessage({
        orderNumber: order.order_number,
        productName: product.product_name,
        machineName: machine.machine_name,
        plannedQuantity: data.plannedQuantity,
        plannedStartTime: data.plannedStartTime,
        plannedEndTime: data.plannedEndTime,
      });
      await sendWorkerMessage(worker.telegram_chat_id, msg);
    }

    // 5. Broadcast to group
    const broadcastText =
      `📋 คำสั่งผลิตใหม่\n` +
      `────────────────────\n` +
      `Order: ${order.order_number}\n` +
      `สินค้า: ${product?.product_name ?? "-"}\n` +
      `เครื่อง: ${machine?.machine_name ?? "-"}\n` +
      `พนักงาน: ${worker?.full_name ?? "-"}\n` +
      `จำนวน: ${data.plannedQuantity.toLocaleString("th-TH")} pcs\n` +
      (data.plannedStartTime ? `เริ่ม: ${data.plannedStartTime} น.\n` : "") +
      (data.plannedEndTime ? `เสร็จ: ${data.plannedEndTime} น.\n` : "") +
      (data.notes ? `หมายเหตุ: ${data.notes}\n` : "") +
      `────────────────────`;

    const { broadcastToGroup } = await import("@/lib/telegram.server");
    const broadcastStatus = await broadcastToGroup(broadcastText);

    return { ok: true, orderId: order.id, broadcast: broadcastStatus };
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
    const now = new Date().toISOString();

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

    const statusMap: Record<string, ProductionOrder["status"]> = {
      start: "in_progress",
      pause: "downtime",
      resume: "in_progress",
      complete: "completed",
      cancel: "cancelled",
    };

    const newStatus = statusMap[data.eventType];
    if (!newStatus) throw new Error("Invalid event type");

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

    const { data: worker } = await supabaseAdmin
      .from("workers")
      .select("telegram_chat_id, full_name")
      .eq("id", order.worker_id)
      .single();

    if (!worker?.telegram_chat_id) {
      return { ok: true, status: newStatus, warning: "Worker Telegram chat ID not found" };
    }

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

    if (product && machine) {
      const msg = buildStatusMessage({
        orderNumber: order.order_number,
        productName: product.product_name,
        machineName: machine.machine_name,
        plannedQuantity: order.planned_quantity,
        status: newStatus,
      });
      await sendWorkerMessage(worker.telegram_chat_id, msg);
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
    const now = new Date().toISOString();

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

    await supabaseAdmin
      .from("production_events")
      .insert({
        order_id: data.orderId,
        event_type: "complete",
        event_time: now,
      });

    const { data: order } = await supabaseAdmin
      .from("production_orders")
      .update({ status: "completed", updated_at: now })
      .eq("id", data.orderId)
      .select("*")
      .single();

    if (order) {
      const { data: worker } = await supabaseAdmin
        .from("workers")
        .select("telegram_chat_id, full_name")
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

      if (worker?.telegram_chat_id && product && machine && lastEvent) {
        const startTime = new Date(lastEvent.event_time);
        const endTime = new Date(now);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = Math.floor(durationMs / 3600000);
        const durationMins = Math.floor((durationMs % 3600000) / 60000);
        const durationSecs = Math.floor((durationMs % 60000) / 1000);
        const durationStr = `${durationHours}:${durationMins.toString().padStart(2, "0")}:${durationSecs.toString().padStart(2, "0")}`;

        const yieldPct = ((data.okQty / (data.okQty + data.ngQty)) * 100).toFixed(1);

        const msg = buildCompletedMessage({
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

        await sendWorkerMessage(worker.telegram_chat_id, msg);
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
    const now = new Date().toISOString();

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

    await supabaseAdmin
      .from("production_events")
      .insert({
        order_id: data.orderId,
        event_type: "pause",
        event_time: now,
      });

    const { data: order } = await supabaseAdmin
      .from("production_orders")
      .update({ status: "downtime", updated_at: now })
      .eq("id", data.orderId)
      .select("*")
      .single();

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

      // Update worker's message to downtime state
      const { data: workerFull } = await supabaseAdmin
        .from("workers")
        .select("telegram_chat_id")
        .eq("id", order.worker_id)
        .single();

      if (workerFull?.telegram_chat_id && product && machine) {
        const msg = buildDowntimeMessage({
          orderNumber: order.order_number,
          productName: product.product_name,
          machineName: machine.machine_name,
          reason: reasonLabels[data.reason] || data.reason,
          startTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        });
        await sendWorkerMessage(workerFull.telegram_chat_id, msg);
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
    const now = new Date().toISOString();

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

    await supabaseAdmin
      .from("production_events")
      .insert({
        order_id: orderId,
        event_type: "resume",
        event_time: now,
      });

    await supabaseAdmin
      .from("production_orders")
      .update({ status: "in_progress", updated_at: now })
      .eq("id", orderId);

    const { data: order } = await supabaseAdmin
      .from("production_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (order) {
      const { data: worker } = await supabaseAdmin
        .from("workers")
        .select("telegram_chat_id")
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

      if (worker?.telegram_chat_id && product && machine) {
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

        const msg = buildInProgressMessage({
          orderNumber: order.order_number,
          productName: product.product_name,
          machineName: machine.machine_name,
          plannedQuantity: order.planned_quantity,
          startTime: startTime.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          elapsedTime: elapsedStr,
        });
        await sendWorkerMessage(worker.telegram_chat_id, msg);
      }
    }

    return { ok: true };
  });

// ============================================
// Plain Text Message Builders (Telegram)
// ============================================

function buildAssignedMessage(data: {
  orderNumber: string;
  productName: string;
  machineName: string;
  plannedQuantity: number;
  plannedStartTime?: string | undefined;
  plannedEndTime?: string | undefined;
}): string {
  return (
    `📋 คำสั่งผลิตใหม่\n` +
    `────────────────────\n` +
    `Order: ${data.orderNumber}\n` +
    `สินค้า: ${data.productName}\n` +
    `เครื่อง: ${data.machineName}\n` +
    `จำนวน: ${data.plannedQuantity.toLocaleString()} pcs\n` +
    (data.plannedStartTime ? `เริ่ม: ${data.plannedStartTime} น.\n` : "") +
    (data.plannedEndTime ? `เสร็จ: ${data.plannedEndTime} น.\n` : "") +
    `────────────────────`
  );
}

function buildStatusMessage(data: {
  orderNumber: string;
  productName: string;
  machineName: string;
  plannedQuantity: number;
  status: ProductionOrder["status"];
}): string {
  const statusLabels: Record<string, string> = {
    assigned: "📋 รับคำสั่งผลิต",
    in_progress: "🔄 กำลังผลิต",
    downtime: "⚠️ หยุดผลิตชั่วคราว",
    completed: "✅ ผลิตเสร็จสิ้น",
    cancelled: "❌ ยกเลิก",
  };
  return (
    `${statusLabels[data.status] ?? data.status}\n` +
    `────────────────────\n` +
    `Order: ${data.orderNumber}\n` +
    `สินค้า: ${data.productName}\n` +
    `เครื่อง: ${data.machineName}\n` +
    `จำนวน: ${data.plannedQuantity.toLocaleString()} pcs\n` +
    `────────────────────`
  );
}

function buildInProgressMessage(data: {
  orderNumber: string;
  productName: string;
  machineName: string;
  plannedQuantity: number;
  startTime: string;
  elapsedTime: string;
}): string {
  return (
    `🔄 กำลังผลิต\n` +
    `────────────────────\n` +
    `Order: ${data.orderNumber}\n` +
    `สินค้า: ${data.productName}\n` +
    `เครื่อง: ${data.machineName}\n` +
    `จำนวน: ${data.plannedQuantity.toLocaleString()} pcs\n` +
    `เริ่ม: ${data.startTime} น.\n` +
    `เวลาผ่านไป: ${data.elapsedTime}\n` +
    `────────────────────`
  );
}

function buildCompletedMessage(data: {
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
}): string {
  return (
    `✅ ผลิตเสร็จสิ้น\n` +
    `────────────────────\n` +
    `Order: ${data.orderNumber}\n` +
    `สินค้า: ${data.productName}\n` +
    `เครื่อง: ${data.machineName}\n` +
    `จำนวน: ${data.plannedQuantity.toLocaleString()} pcs\n` +
    `เริ่ม: ${data.startTime} น.\n` +
    `เสร็จ: ${data.endTime} น.\n` +
    `รวมเวลา: ${data.duration}\n` +
    `────────────────────\n` +
    `OK: ${data.okQty.toLocaleString()} pcs\n` +
    `NG: ${data.ngQty.toLocaleString()} pcs\n` +
    `Yield: ${data.yield}%\n` +
    `────────────────────`
  );
}

function buildDowntimeMessage(data: {
  orderNumber: string;
  productName: string;
  machineName: string;
  reason: string;
  startTime: string;
}): string {
  return (
    `⚠️ หยุดผลิตชั่วคราว\n` +
    `────────────────────\n` +
    `Order: ${data.orderNumber}\n` +
    `สินค้า: ${data.productName}\n` +
    `เครื่อง: ${data.machineName}\n` +
    `สาเหตุ: ${data.reason}\n` +
    `เวลาเริ่ม: ${data.startTime} น.\n` +
    `────────────────────\n` +
    `ระบบได้แจ้งเตือนทีม Maintenance แล้ว`
  );
}

// ============================================
// Send Message to Worker
// ============================================

async function sendWorkerMessage(chatId: string, text: string): Promise<void> {
  const { sendTelegramMessage } = await import("@/lib/telegram.server");
  try {
    await sendTelegramMessage(chatId, text);
  } catch (e) {
    console.error("Telegram worker message failed", e);
  }
}

async function sendDowntimeAlert(data: {
  machineName: string;
  productName: string;
  workerName: string;
  reason: string;
  reasonDetail?: string | undefined;
  time: string;
  orderNumber: string;
}): Promise<void> {
  const { sendDowntimeAlert: send } = await import("@/lib/telegram.server");
  await send(data);
}
