import { createServerFn } from "@tanstack/react-start";

export const replyToConversation = createServerFn({ method: "POST" })
  .inputValidator((data: { conversationId: string; text: string }) => {
    if (!data.conversationId || !data.text?.trim()) {
      throw new Error("conversationId and text are required");
    }
    if (data.text.length > 5000) throw new Error("Message too long");
    return { conversationId: data.conversationId, text: data.text.trim() };
  })
  .handler(async ({ data }) => {
    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    if (!token) throw new Error("LINE Channel access token ยังไม่ได้ตั้งค่า");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: convo, error: convoError } = await supabaseAdmin
      .from("conversations")
      .select("line_user_id")
      .eq("id", data.conversationId)
      .single();
    if (convoError || !convo) throw new Error("ไม่พบการสนทนา");

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: convo.line_user_id,
        messages: [{ type: "text", text: data.text }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("LINE push failed", res.status, errText);
      throw new Error("ส่งข้อความไป LINE ไม่สำเร็จ");
    }

    const now = new Date().toISOString();
    await supabaseAdmin.from("messages").insert({
      conversation_id: data.conversationId,
      direction: "outbound",
      message_type: "text",
      text: data.text,
    });
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message_at: now,
        last_message_text: data.text,
        unread_count: 0,
      })
      .eq("id", data.conversationId);

    return { ok: true };
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string }) => {
    if (!data.text?.trim()) throw new Error("text is required");
    if (data.text.length > 5000) throw new Error("Message too long");
    return { text: data.text.trim() };
  })
  .handler(async ({ data }) => {
    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    if (!token) throw new Error("LINE Channel access token ยังไม่ได้ตั้งค่า");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [{ type: "text", text: data.text }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("LINE broadcast failed", res.status, errText);
      await supabaseAdmin.from("broadcasts").insert({
        text: data.text,
        status: "failed",
        error: `LINE API error ${res.status}`,
      });
      throw new Error("ส่ง Broadcast ไม่สำเร็จ");
    }

    await supabaseAdmin
      .from("broadcasts")
      .insert({ text: data.text, status: "sent" });
    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    return { ok: true };
  });

// ============================================
// Flex Message Helpers
// ============================================

export async function sendFlexMessage(
  to: string,
  flexMessage: object
): Promise<void> {
  const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
  if (!token) throw new Error("LINE Channel access token not configured");

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [flexMessage],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE push failed", res.status, errText);
    throw new Error("Failed to send Flex Message");
  }
}

export async function sendDowntimeAlert(data: {
  machineName: string;
  productName: string;
  workerName: string;
  reason: string;
  reasonDetail?: string;
  time: string;
  orderNumber: string;
}): Promise<void> {
  const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
  const adminGroupId = process.env["LINE_ADMIN_GROUP_ID"];

  if (!token) throw new Error("LINE Channel access token not configured");
  if (!adminGroupId) {
    console.warn("LINE_ADMIN_GROUP_ID not configured, skipping downtime alert");
    return;
  }

  const message = {
    type: "text",
    text:
      `🚨 แจ้งปัญหาการผลิต\n` +
      `────────────────────\n` +
      `เครื่อง: ${data.machineName}\n` +
      `สินค้า: ${data.productName}\n` +
      `Order: ${data.orderNumber}\n` +
      `ผู้แจ้ง: ${data.workerName}\n` +
      `สาเหตุ: ${data.reason}` +
      (data.reasonDetail ? ` (${data.reasonDetail})` : "") +
      `\nเวลา: ${data.time} น.\n` +
      `────────────────────\n` +
      `กดลิงก์เพื่อดูรายละเอียด: https://linechat-prototype.lovable.app/dashboard`,
  };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: adminGroupId,
      messages: [message],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE downtime alert failed", res.status, errText);
  }
}
