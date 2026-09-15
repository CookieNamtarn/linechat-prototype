import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  text?: string;
  photo?: unknown[];
  sticker?: unknown;
  video?: unknown;
  voice?: unknown;
  document?: unknown;
  location?: unknown;
};

function deriveWebhookSecret(connectionKey: string): string {
  return createHash("sha256")
    .update(`telegram-webhook:${connectionKey}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function previewOf(msg: TelegramMessage): { type: string; text: string } {
  if (msg.text) return { type: "text", text: msg.text };
  if (msg.photo) return { type: "photo", text: "[รูปภาพ]" };
  if (msg.sticker) return { type: "sticker", text: "[สติกเกอร์]" };
  if (msg.video) return { type: "video", text: "[วิดีโอ]" };
  if (msg.voice) return { type: "voice", text: "[เสียง]" };
  if (msg.document) return { type: "document", text: "[ไฟล์]" };
  if (msg.location) return { type: "location", text: "[ตำแหน่ง]" };
  return { type: "other", text: "[ข้อความ]" };
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const connectionKey = process.env["TELEGRAM_API_KEY"];
        if (!connectionKey) {
          return new Response("Telegram not configured", { status: 500 });
        }

        const expected = deriveWebhookSecret(connectionKey);
        const provided =
          request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as {
          update_id?: number;
          message?: TelegramMessage;
          edited_message?: TelegramMessage;
        };
        const message = update.message ?? update.edited_message;
        if (!message?.chat?.id) return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const chatId = String(message.chat.id);
        const isGroup =
          message.chat.type === "group" || message.chat.type === "supergroup";

        // อัปเดตรหัสกลุ่มทุกครั้งที่ได้รับข้อความจากกลุ่ม — ไม่จำกัดครั้งแรก
        if (isGroup) {
          await supabaseAdmin.from("app_settings").upsert(
            {
              key: "telegram_group_chat_id",
              value: chatId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          );
          return Response.json({ ok: true, group: true });
        }

        const displayName =
          [message.from?.first_name, message.from?.last_name]
            .filter(Boolean)
            .join(" ") ||
          message.from?.username ||
          message.chat.title ||
          null;

        const preview = previewOf(message);

        const { data: existing } = await supabaseAdmin
          .from("conversations")
          .select("id, unread_count")
          .eq("telegram_chat_id", chatId)
          .maybeSingle();

        let conversationId: string;
        if (existing) {
          conversationId = existing.id;
          await supabaseAdmin
            .from("conversations")
            .update({
              display_name: displayName,
              last_message_at: new Date().toISOString(),
              last_message_text: preview.text,
              unread_count: (existing.unread_count ?? 0) + 1,
            })
            .eq("id", existing.id);
        } else {
          const { data: created, error } = await supabaseAdmin
            .from("conversations")
            .insert({
              telegram_chat_id: chatId,
              line_user_id: chatId,
              display_name: displayName,
              last_message_at: new Date().toISOString(),
              last_message_text: preview.text,
              unread_count: 1,
            })
            .select("id")
            .single();
          if (error || !created) {
            console.error("Failed to create conversation", error);
            return Response.json({ ok: true, stored: false });
          }
          conversationId = created.id;
        }

        const { error: msgError } = await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          direction: "inbound",
          message_type: preview.type,
          text: preview.text,
          line_message_id: String(message.message_id),
        });
        if (msgError) console.error("Failed to store message", msgError);

        return Response.json({ ok: true });
      },
    },
  },
});
