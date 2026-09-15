const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export const GROUP_CHAT_SETTING_KEY = "telegram_group_chat_id";

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export async function telegramCall<T = unknown>(
  method: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("ยังไม่ได้เชื่อมต่อ Telegram bot");
  }

  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Telegram ${method} failed [${res.status}]: ${errText}`);
    throw new Error(`ส่งคำสั่มไป Telegram ไม่สำเร็จ (${res.status})`);
  }

  const json = (await res.json()) as TelegramResponse<T>;
  if (!json.ok) {
    console.error(`Telegram ${method} error: ${json.description ?? "unknown"}`);
    throw new Error(`Telegram: ${json.description ?? "unknown error"}`);
  }
  return json.result as T;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string
): Promise<void> {
  await telegramCall("sendMessage", { chat_id: chatId, text });
}

export async function getGroupChatId(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", GROUP_CHAT_SETTING_KEY)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setGroupChatIdValue(chatId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_settings")
    .upsert(
      { key: GROUP_CHAT_SETTING_KEY, value: chatId, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
}

export async function clearGroupChatId(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_settings")
    .update({ value: null, updated_at: new Date().toISOString() })
    .eq("key", GROUP_CHAT_SETTING_KEY);
}

export async function broadcastToGroup(text: string): Promise<"sent" | "failed"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const chatId = await getGroupChatId();
  if (!chatId) {
    await supabaseAdmin.from("broadcasts").insert({
      text,
      status: "failed",
      error: "ยังไม่ได้ตั้งค่ากลุ่ม Telegram",
    });
    return "failed";
  }
  try {
    await sendTelegramMessage(chatId, text);
    await supabaseAdmin.from("broadcasts").insert({ text, status: "sent" });
    return "sent";
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("broadcasts").insert({
      text,
      status: "failed",
      error: reason,
    });
    return "failed";
  }
}

export async function sendDowntimeAlert(data: {
  machineName: string;
  productName: string;
  workerName: string;
  reason: string;
  reasonDetail?: string | undefined;
  time: string;
  orderNumber: string;
}): Promise<void> {
  const text =
    `🚨 แจ้งปัญหาการผลิต\n` +
    `────────────────────\n` +
    `เครื่อง: ${data.machineName}\n` +
    `สินค้า: ${data.productName}\n` +
    `Order: ${data.orderNumber}\n` +
    `ผู้แจ้ง: ${data.workerName}\n` +
    `สาเหตุ: ${data.reason}` +
    (data.reasonDetail ? ` (${data.reasonDetail})` : "") +
    `\nเวลา: ${data.time} น.\n` +
    `────────────────────`;

  const chatId = await getGroupChatId();
  if (!chatId) {
    console.warn("Telegram group chat not configured, skipping downtime alert");
    return;
  }
  try {
    await sendTelegramMessage(chatId, text);
  } catch (e) {
    console.error("Telegram downtime alert failed", e);
  }
}
