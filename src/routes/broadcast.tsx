import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  sendBroadcast,
  getTelegramGroup,
  setTelegramGroup,
} from "@/lib/telegram.functions";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/broadcast")({
  head: () => ({
    meta: [
      { title: "Broadcast — ส่งข้อความกระจาย Telegram" },
      {
        name: "description",
        content: "ส่งข้อความกระจายถึงผู้ติดตาม Telegram ทั้งหมดพร้อมกัน",
      },
      { property: "og:title", content: "Broadcast — ส่งข้อความกระจาย Telegram" },
      {
        property: "og:description",
        content: "ส่งข้อความกระจายถึงผู้ติดตาม Telegram ทั้งหมดพร้อมกัน",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BroadcastPage,
});

type Broadcast = {
  id: string;
  text: string;
  status: string;
  error: string | null;
  created_at: string;
};

function BroadcastPage() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const broadcastFn = useServerFn(sendBroadcast);
  const getGroupFn = useServerFn(getTelegramGroup);
  const setGroupFn = useServerFn(setTelegramGroup);
  const [groupInput, setGroupInput] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  const { data: group } = useQuery({
    queryKey: ["telegram-group"],
    queryFn: () => getGroupFn({}),
  });

  const saveGroup = async () => {
    if (!groupInput.trim() || savingGroup) return;
    setSavingGroup(true);
    try {
      await setGroupFn({ data: { chatId: groupInput.trim() } });
      toast.success("บันทึกกลุ่มปลายทางแล้ว");
      setGroupInput("");
      queryClient.invalidateQueries({ queryKey: ["telegram-group"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingGroup(false);
    }
  };


  const { data: history = [] } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Broadcast[];
    },
  });

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await broadcastFn({ data: { text } });
      toast.success("ส่ง Broadcast เรียบร้อยแล้ว");
      setText("");
      queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่ง Broadcast ไม่สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          aria-label="กลับไปหน้า Inbox"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#06C755]">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-lg font-semibold">ส่งข้อความกระจาย (Broadcast)</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 p-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold">กลุ่ม Telegram ปลายทาง</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            เพิ่มบอทเข้ากลุ่ม แล้วพิมพ์ข้อความในกลุ่ม 1 ครั้ง ระบบจะจำรหัสกลุ่มให้อัตโนมัติ
            หรือกรอกรหัสกลุ่มเอง (เช่น -1001234567890)
          </p>
          <div className="flex gap-2">
            <input
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              placeholder="-1001234567890"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#06C755]/50"
            />
            <button
              onClick={saveGroup}
              disabled={savingGroup || !groupInput.trim()}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
            >
              {savingGroup ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            สถานะ:{" "}
            {group?.chatId
              ? `ตั้งค่ากลุ่มแล้ว (${group.chatId})`
              : "ยังไม่ได้ตั้งค่ากลุ่ม"}
          </p>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <label className="mb-2 block text-sm font-medium">
            ข้อความถึงกลุ่ม Telegram
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="พิมพ์ข้อความที่ต้องการส่งถึงผู้ติดตาม Telegram ทุกคน..."
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#06C755]/50"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {text.length}/5000 ตัวอักษร
            </span>
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b04b] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {sending ? "กำลังส่ง..." : "ส่งถึงทุกคน"}
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">ประวัติการส่ง</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่เคยส่งข้อความกระจาย
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((b) => (
                <div key={b.id} className="rounded-xl border bg-card p-4">
                  <p className="whitespace-pre-wrap text-sm">{b.text}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                        b.status === "sent"
                          ? "bg-[#06C755]/10 text-[#06C755]"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {b.status === "sent" ? "ส่งสำเร็จ" : "ส่งไม่สำเร็จ"}
                    </span>
                    <span>
                      {new Date(b.created_at).toLocaleString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
