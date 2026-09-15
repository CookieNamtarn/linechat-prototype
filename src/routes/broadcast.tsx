import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  sendBroadcast,
  testGroupMessage,
  clearTelegramGroup,
} from "@/lib/telegram.functions";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Megaphone, Send, TestTube, Trash2 } from "lucide-react";
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
  const testGroupFn = useServerFn(testGroupMessage);
  const clearGroupFn = useServerFn(clearTelegramGroup);
  const [testChatId, setTestChatId] = useState("");
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const { data: group } = useQuery({
    queryKey: ["telegram-group"],
    queryFn: async () => {
      const { getTelegramGroup } = await import("@/lib/telegram.functions");
      const fn = useServerFn(getTelegramGroup);
      return fn({});
    },
  });

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

  const testGroup = async () => {
    if (!testChatId.trim() || testing) return;
    setTesting(true);
    try {
      await testGroupFn({ data: { chatId: testChatId.trim() } });
      toast.success("ส่งข้อความทดสอบสำเร็จ!");
      setTestChatId("");
      queryClient.invalidateQueries({ queryKey: ["telegram-group"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  };

  const clearGroup = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await clearGroupFn({});
      toast.success("ล้างค่ากลุ่มแล้ว");
      queryClient.invalidateQueries({ queryKey: ["telegram-group"] });
    } catch (e) {
      toast.error("ล้างค่าไม่สำเร็จ");
    } finally {
      setClearing(false);
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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0088CC]">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-lg font-semibold">ส่งข้อความกระจาย (Broadcast)</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 p-6">
        {/* Group Status */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold">กลุ่ม Telegram ปลายทาง</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            รหัสกลุ่มปัจจุบัน:{" "}
            {group?.chatId ? (
              <span className="font-mono text-foreground">{group.chatId}</span>
            ) : (
              <span className="text-red-500">ยังไม่ได้ตั้งค่า</span>
            )}
          </p>
          <div className="flex gap-2">
            <input
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="กรอกรหัสกลุ่ม (เช่น -1001234567890)"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0088CC]/50"
            />
            <button
              onClick={testGroup}
              disabled={testing || !testChatId.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0088CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#006da3] disabled:opacity-40"
            >
              <TestTube className="h-4 w-4" />
              {testing ? "กำลังส่ง..." : "ทดสอบส่ง"}
            </button>
            <button
              onClick={clearGroup}
              disabled={clearing}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              ล้างค่า
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            เพิ่มบอทเข้ากลุ่ม แล้วพิมพ์ข้อความในกลุ่ม 1 ครั้ง ระบบจะจำรหัสกลุ่มให้อัตโนมัติ
          </p>
        </section>

        {/* Broadcast Form */}
        <section className="rounded-xl border bg-card p-5">
          <label className="mb-2 block text-sm font-medium">
            ข้อความถึงกลุ่ม Telegram
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="พิมพ์ข้อความที่ต้องการส่งถึงกลุ่ม Telegram..."
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0088CC]/50"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {text.length}/4000 ตัวอักษร
            </span>
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0088CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#006da3] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {sending ? "กำลังส่ง..." : "ส่งถึงกลุ่ม"}
            </button>
          </div>
        </section>

        {/* History */}
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
                          ? "bg-green-100 text-green-800"
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
                  {b.error && (
                    <p className="mt-1 text-xs text-red-500">{b.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
