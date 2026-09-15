import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { replyToConversation, markConversationRead, getTelegramGroup, setTelegramGroup } from "@/lib/telegram.functions";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, Megaphone, ClipboardList, User, Settings, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Telegram Inbox — จัดการแชทลูกค้า" },
      {
        name: "description",
        content:
          "รับ-ตอบแชทลูกค้าจาก Telegram แบบเรียลไทม์ และส่งข้อความกระจายถึงผู้ติดตามทั้งหมด",
      },
      { property: "og:title", content: "Telegram Inbox — จัดการแชทลูกค้า" },
      {
        property: "og:description",
        content:
          "รับ-ตอบแชทลูกค้าจาก Telegram แบบเรียลไทม์ และส่งข้อความกระจายถึงผู้ติดตามทั้งหมด",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inbox,
});

type Conversation = {
  id: string;
  telegram_chat_id: string | null;
  display_name: string | null;
  picture_url: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  text: string | null;
  created_at: string;
};

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Inbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const replyFn = useServerFn(replyToConversation);
  const markReadFn = useServerFn(markConversationRead);
  const getGroupFn = useServerFn(getTelegramGroup);
  const setGroupFn = useServerFn(setTelegramGroup);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [groupInput, setGroupInput] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Conversation[];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  const { data: group } = useQuery({
    queryKey: ["telegram-group"],
    queryFn: () => getGroupFn({}),
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => queryClient.invalidateQueries({ queryKey: ["conversations"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const selectConversation = (id: string) => {
    setSelectedId(id);
    markReadFn({ data: { conversationId: id } }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    );
  };

  const send = async () => {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    try {
      await replyFn({ data: { conversationId: selectedId, text: draft } });
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0088CC]">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold">Telegram Inbox</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent ${showSettings ? "bg-accent" : ""}`}
            aria-label="ตั้งค่ากลุ่ม"
          >
            <Settings className="h-5 w-5" />
          </button>
          <Link
            to="/planner"
            className="inline-flex items-center gap-2 rounded-md bg-[#1A73E8] px-3 py-2 text-sm font-medium text-white hover:bg-[#1557b0]"
          >
            <ClipboardList className="h-4 w-4" />
            Planner
          </Link>
          <Link
            to="/broadcast"
            className="inline-flex items-center gap-2 rounded-md bg-[#0088CC] px-3 py-2 text-sm font-medium text-white hover:bg-[#006da3]"
          >
            <Megaphone className="h-4 w-4" />
            Broadcast
          </Link>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-2 text-sm font-semibold">ตั้งค่ากลุ่ม Telegram ปลายทาง</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              เพิ่มบอทเข้ากลุ่ม แล้วพิมพ์ข้อความในกลุ่ม 1 ครั้ง ระบบจะจำรหัสกลุ่มให้อัตโนมัติ
              หรือกรอกรหัสกลุ่มเอง (เช่น -1001234567890)
            </p>
            <div className="flex gap-2">
              <input
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                placeholder="-1001234567890"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0088CC]/50"
              />
              <button
                onClick={saveGroup}
                disabled={savingGroup || !groupInput.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0088CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#006da3] disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                {savingGroup ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              สถานะ:{" "}
              {group?.chatId
                ? `ตั้งค่ากลุ่มแล้ว (${group.chatId})`
                : "ยังไม่ได้ตั้งค่ากลุ่ม"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <aside className="w-full max-w-xs overflow-y-auto border-r bg-card">
          {conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="mb-2 h-10 w-10 opacity-40" />
              <p>ยังไม่มีการสนทนา</p>
              <p className="mt-1">
                เมื่อมีลูกค้าทักเข้ามาทาง Telegram การสนทนาจะแสดงที่นี่
              </p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent ${
                  selectedId === c.id ? "bg-accent" : ""
                }`}
              >
                {c.picture_url ? (
                  <img
                    src={c.picture_url}
                    alt={c.display_name ?? "ผู้ใช้ Telegram"}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.display_name ?? "ผู้ใช้ Telegram"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeLabel(c.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_message_text ?? ""}
                    </p>
                    {c.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#0088CC] px-1.5 text-xs font-medium text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </aside>

        {/* Chat window */}
        <main className="flex flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              เลือกการสนทนาทางซ้ายเพื่อดูข้อความ
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
                {selected.picture_url ? (
                  <img
                    src={selected.picture_url}
                    alt={selected.display_name ?? "ผู้ใช้ Telegram"}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="font-medium">
                  {selected.display_name ?? "ผู้ใช้ Telegram"}
                </span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                        m.direction === "outbound"
                          ? "rounded-br-sm bg-[#0088CC] text-white"
                          : "rounded-bl-sm border bg-card"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          m.direction === "outbound"
                            ? "text-white/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="flex items-end gap-2 border-t bg-card p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="พิมพ์ข้อความตอบกลับ..."
                  rows={1}
                  className="max-h-32 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0088CC]/50"
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0088CC] text-white transition-colors hover:bg-[#006da3] disabled:opacity-40"
                  aria-label="ส่งข้อความ"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
