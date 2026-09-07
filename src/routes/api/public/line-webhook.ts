import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type LineEvent = {
  type: string;
  replyToken?: string;
  timestamp?: number;
  source?: { type: string; userId?: string };
  message?: { id: string; type: string; text?: string };
};

export const Route = createFileRoute("/api/public/line-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const channelSecret = process.env["LINE_CHANNEL_SECRET"];
        const channelToken = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
        if (!channelSecret || !channelToken) {
          return new Response("LINE credentials not configured", { status: 500 });
        }

        const body = await request.text();
        const signature = request.headers.get("x-line-signature") ?? "";
        const expected = createHmac("sha256", channelSecret)
          .update(body)
          .digest("base64");
        const sig = Buffer.from(signature);
        const exp = Buffer.from(expected);
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = JSON.parse(body) as { events?: LineEvent[] };
        const events = payload.events ?? [];

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        for (const event of events) {
          const userId = event.source?.userId;
          if (!userId) continue;

          if (event.type === "message" && event.message) {
            // Fetch sender profile from LINE
            let displayName: string | null = null;
            let pictureUrl: string | null = null;
            try {
              const res = await fetch(
                `https://api.line.me/v2/bot/profile/${userId}`,
                { headers: { Authorization: `Bearer ${channelToken}` } }
              );
              if (res.ok) {
                const profile = (await res.json()) as {
                  displayName?: string;
                  pictureUrl?: string;
                };
                displayName = profile.displayName ?? null;
                pictureUrl = profile.pictureUrl ?? null;
              }
            } catch (e) {
              console.error("Failed to fetch LINE profile", e);
            }

            // Upsert conversation
            const { data: existing } = await supabaseAdmin
              .from("conversations")
              .select("id, unread_count")
              .eq("line_user_id", userId)
              .maybeSingle();

            const msg = event.message;
            const previewText =
              msg.type === "text"
                ? (msg.text ?? "")
                : msg.type === "sticker"
                  ? "[สติกเกอร์]"
                  : msg.type === "image"
                    ? "[รูปภาพ]"
                    : msg.type === "video"
                      ? "[วิดีโอ]"
                      : msg.type === "audio"
                        ? "[เสียง]"
                        : msg.type === "location"
                          ? "[ตำแหน่ง]"
                          : "[ข้อความ]";

            let conversationId: string;
            if (existing) {
              conversationId = existing.id;
              await supabaseAdmin
                .from("conversations")
                .update({
                  display_name: displayName ?? null,
                  picture_url: pictureUrl ?? null,
                  last_message_at: new Date().toISOString(),
                  last_message_text: previewText,
                  unread_count: (existing.unread_count ?? 0) + 1,
                })
                .eq("id", existing.id);
            } else {
              const { data: created, error } = await supabaseAdmin
                .from("conversations")
                .insert({
                  line_user_id: userId,
                  display_name: displayName,
                  picture_url: pictureUrl,
                  last_message_at: new Date().toISOString(),
                  last_message_text: previewText,
                  unread_count: 1,
                })
                .select("id")
                .single();
              if (error || !created) {
                console.error("Failed to create conversation", error);
                continue;
              }
              conversationId = created.id;
            }

            const { error: msgError } = await supabaseAdmin
              .from("messages")
              .insert({
                conversation_id: conversationId,
                direction: "inbound",
                message_type: msg.type,
                text: msg.type === "text" ? (msg.text ?? null) : previewText,
                line_message_id: msg.id,
              });
            if (msgError) console.error("Failed to store message", msgError);
          } else if (event.type === "follow") {
            const { data: existing } = await supabaseAdmin
              .from("conversations")
              .select("id")
              .eq("line_user_id", userId)
              .maybeSingle();
            if (!existing) {
              await supabaseAdmin.from("conversations").insert({
                line_user_id: userId,
                last_message_text: "เริ่มติดตาม",
              });
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
