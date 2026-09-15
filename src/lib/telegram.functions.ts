import { createServerFn } from "@tanstack/react-start";

export const replyToConversation = createServerFn({ method: "POST" })
  .inputValidator((data: { conversationId: string; text: string }) => {
    if (!data.conversationId || !data.text?.trim()) {
      throw new Error("conversationId and text are required");
    }
    if (data.text.length > 4000) throw new Error("Message too long");
    return { conversationId: data.conversationId, text: data.text.trim() };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { sendTelegramMessage } = await import("@/lib/telegram.server");

    const { data: convo, error: convoError } = await supabaseAdmin
      .from("conversations")
      .select("telegram_chat_id")
      .eq("id", data.conversationId)
      .single();
    if (convoError || !convo?.telegram_chat_id) throw new Error("ไม่พบการสนทนา");

    await sendTelegramMessage(convo.telegram_chat_id, data.text);

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
    if (data.text.length > 4000) throw new Error("Message too long");
    return { text: data.text.trim() };
  })
  .handler(async ({ data }) => {
    const { broadcastToGroup, getGroupChatId } = await import(
      "@/lib/telegram.server"
    );
    const chatId = await getGroupChatId();
    if (!chatId) {
      throw new Error(
        "ยังไม่ได้ตั้งค่ากลุ่ม Telegram — เพิ่มบอทเข้ากลุ่มแล้วพิมพ์ข้อความในกลุ่ม 1 ครั้ง หรือกรอกรหัสกลุ่มด้านล่าง"
      );
    }
    const status = await broadcastToGroup(data.text);
    if (status === "failed") throw new Error("ส่งข้อความเข้ากลุ่มไม่สำเร็จ");
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

export const getTelegramGroup = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getGroupChatId } = await import("@/lib/telegram.server");
    return { chatId: await getGroupChatId() };
  }
);

export const setTelegramGroup = createServerFn({ method: "POST" })
  .inputValidator((data: { chatId: string }) => {
    const chatId = data.chatId?.trim();
    if (!chatId) throw new Error("กรุณากรอกรหัสกลุ่ม");
    if (!/^-?\d+$/.test(chatId)) throw new Error("รหัสกลุ่มต้องเป็นตัวเลข เช่น -1001234567890");
    return { chatId };
  })
  .handler(async ({ data }) => {
    const { setGroupChatIdValue } = await import("@/lib/telegram.server");
    await setGroupChatIdValue(data.chatId);
    return { ok: true, chatId: data.chatId };
  });

export const testGroupMessage = createServerFn({ method: "POST" })
  .inputValidator((data: { chatId: string }) => {
    const chatId = data.chatId?.trim();
    if (!chatId) throw new Error("กรุณากรอกรหัสกลุ่ม");
    if (!/^-?\d+$/.test(chatId)) throw new Error("รหัสกลุ่มต้องเป็นตัวเลข เช่น -1001234567890");
    return { chatId };
  })
  .handler(async ({ data }) => {
    const { sendTelegramMessage, setGroupChatIdValue } = await import("@/lib/telegram.server");
    try {
      await sendTelegramMessage(data.chatId, "✅ ทดสอบส่งข้อความสำเร็จ!");
      // บันทึกรหัสกลุ่มอัตโนมัติเมื่อส่งสำเร็จ
      await setGroupChatIdValue(data.chatId);
      return { ok: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new Error(`ส่งไม่สำเร็จ: ${reason}`);
    }
  });

export const clearTelegramGroup = createServerFn({ method: "POST" }).handler(
  async () => {
    const { clearGroupChatId } = await import("@/lib/telegram.server");
    await clearGroupChatId();
    return { ok: true };
  }
);
