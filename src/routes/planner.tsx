import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Send,
  Zap,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMasterData,
  getTemplates,
  createTemplate,
  deleteTemplate,
  getActiveOrders,
  getOrdersHistory,
} from "@/lib/planner.functions";
import { createProductionOrder } from "@/lib/production.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Planner Dashboard — สั่งงานผลิต" },
      {
        name: "description",
        content: "หน้าสั่งงานผลิต สร้างคำสั่งผลิตและส่งให้พนักงานผ่าน LINE OA",
      },
    ],
  }),
  component: PlannerDashboard,
});

// Types
type Product = { id: string; sku: string; product_name: string; unit: string };
type Machine = { id: string; machine_code: string; machine_name: string };
type Worker = {
  id: string;
  full_name: string;
  employee_id: string;
  machines?: { machine_code: string; machine_name: string };
};
type Template = {
  id: string;
  template_name: string;
  product_id: string;
  machine_id: string;
  worker_id: string;
  products: { sku: string; product_name: string; unit: string };
  machines: { machine_code: string; machine_name: string };
  workers: { full_name: string; employee_id: string };
  planned_quantity: number;
  planned_start_time: string | null;
  planned_end_time: string | null;
  notes: string | null;
};
type Order = {
  id: string;
  order_number: string;
  status: string;
  planned_quantity: number;
  created_at: string;
  products: { sku: string; product_name: string; unit: string };
  machines: { machine_code: string; machine_name: string };
  workers: { full_name: string; employee_id: string };
  production_outputs?: { ok_qty: number; ng_qty: number }[];
};

function PlannerDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"form" | "templates" | "orders">("form");

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [selectedWorker, setSelectedWorker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Fetch master data
  const masterDataFn = useServerFn(getMasterData);
  const templatesFn = useServerFn(getTemplates);
  const activeOrdersFn = useServerFn(getActiveOrders);
  const ordersHistoryFn = useServerFn(getOrdersHistory);
  const createTemplateFn = useServerFn(createTemplate);
  const deleteTemplateFn = useServerFn(deleteTemplate);
  const createOrderFn = useServerFn(createProductionOrder);

  const { data: masterData } = useQuery({
    queryKey: ["masterData"],
    queryFn: () => masterDataFn(),
  });

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: () => templatesFn(),
  });

  const { data: activeOrders } = useQuery({
    queryKey: ["activeOrders"],
    queryFn: () => activeOrdersFn(),
  });

  const { data: ordersHistory } = useQuery({
    queryKey: ["ordersHistory"],
    queryFn: () => ordersHistoryFn(),
  });

  // Show all active workers (not bound to machines)
  const filteredWorkers = masterData?.workers ?? [];

  // Get product unit display
  const selectedProductData = masterData?.products.find(
    (p) => p.id === selectedProduct
  );
  const unitDisplay = selectedProductData?.unit || "pcs";

  // Handler: Create order from form
  const handleSubmitOrder = async () => {
    if (!selectedProduct || !selectedMachine || !selectedWorker || !quantity) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("จำนวนต้องเป็นตัวเลขมากกว่า 0");
      return;
    }

    setSending(true);
    try {
      // Generate order number
      const dateStr = new Date()
        .toLocaleDateString("en-GB")
        .replace(/\//g, "")
        .slice(0, 8);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      const orderNumber = `ORD-${dateStr}-${random}`;

      await createOrderFn({
        data: {
          orderNumber,
          productId: selectedProduct,
          machineId: selectedMachine,
          workerId: selectedWorker,
          plannedQuantity: qty,
          plannedStartTime: startTime,
          plannedEndTime: endTime,
          notes: notes || undefined,
          createdBy: "Planner",
        },
      });

      toast.success(`ส่งคำสั่งผลิต ${orderNumber} สำเร็จ!`);

      // Reset form
      setSelectedProduct("");
      setSelectedMachine("");
      setSelectedWorker("");
      setQuantity("");
      setNotes("");

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["activeOrders"] });
      queryClient.invalidateQueries({ queryKey: ["ordersHistory"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  // Handler: Quick send from template
  const handleSendFromTemplate = async (template: Template) => {
    setSending(true);
    try {
      const dateStr = new Date()
        .toLocaleDateString("en-GB")
        .replace(/\//g, "")
        .slice(0, 8);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      const orderNumber = `ORD-${dateStr}-${random}`;

      await createOrderFn({
        data: {
          orderNumber,
          productId: template.product_id,
          machineId: template.machine_id,
          workerId: template.worker_id,
          plannedQuantity: template.planned_quantity,
          plannedStartTime: template.planned_start_time || undefined,
          plannedEndTime: template.planned_end_time || undefined,
          notes: template.notes || undefined,
          createdBy: "Planner",
        },
      });

      toast.success(`ส่ง ${template.template_name} สำเร็จ!`);
      queryClient.invalidateQueries({ queryKey: ["activeOrders"] });
      queryClient.invalidateQueries({ queryKey: ["ordersHistory"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  // Handler: Create template from current form
  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("กรุณากรอกชื่อ Template");
      return;
    }
    if (!selectedProduct || !selectedMachine || !selectedWorker || !quantity) {
      toast.error("กรุณาฟอร์มข้อมูลก่อนบันทึก Template");
      return;
    }

    try {
      await createTemplateFn({
        data: {
          templateName: templateName.trim(),
          productId: selectedProduct,
          machineId: selectedMachine,
          workerId: selectedWorker,
          plannedQuantity: parseInt(quantity),
          plannedStartTime: startTime,
          plannedEndTime: endTime,
          notes: notes || undefined,
        },
      });

      toast.success(`บันทึก Template "${templateName}" แล้ว`);
      setShowTemplateForm(false);
      setTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึก Template ไม่สำเร็จ");
    }
  };

  // Handler: Delete template
  const handleDeleteTemplate = async (templateId: string, name: string) => {
    if (!confirm(`ลบ Template "${name}"?`)) return;
    try {
      await deleteTemplateFn({ data: { templateId } });
      toast.success(`ลบ Template "${name}" แล้ว`);
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (e) {
      toast.error("ลบ Template ไม่สำเร็จ");
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { color: string; label: string; icon: any }> = {
      assigned: {
        color: "bg-blue-100 text-blue-800",
        label: "รอเริ่ม",
        icon: Clock,
      },
      in_progress: {
        color: "bg-indigo-100 text-indigo-800",
        label: "กำลังผลิต",
        icon: Zap,
      },
      downtime: {
        color: "bg-red-100 text-red-800",
        label: "หยุดผลิต",
        icon: AlertTriangle,
      },
      completed: {
        color: "bg-green-100 text-green-800",
        label: "เสร็จสิ้น",
        icon: CheckCircle,
      },
      cancelled: {
        color: "bg-gray-100 text-gray-800",
        label: "ยกเลิก",
        icon: XCircle,
      },
    };
    const c = config[status] ?? config['assigned']!;
    const Icon = c.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.color}`}
      >
        <Icon className="h-3 w-3" />
        {c.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            aria-label="กลับไปหน้า Inbox"
          >
            ←
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A73E8]">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold">Planner Dashboard</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          สั่งงานผลิตผ่าน LINE OA
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-card px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("form")}
            className={`border-b-2 py-3 text-sm font-medium ${
              activeTab === "form"
                ? "border-[#1A73E8] text-[#1A73E8]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              สร้างคำสั่งผลิต
            </span>
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`border-b-2 py-3 text-sm font-medium ${
              activeTab === "templates"
                ? "border-[#1A73E8] text-[#1A73E8]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Template (1-Click)
            </span>
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`border-b-2 py-3 text-sm font-medium ${
              activeTab === "orders"
                ? "border-[#1A73E8] text-[#1A73E8]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              คำสั่งผลิตวันนี้
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl p-6">
        {/* ===== TAB 1: FORM ===== */}
        {activeTab === "form" && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6">
              <h2 className="mb-4 text-base font-semibold">
                สร้างคำสั่งผลิตใหม่
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Product */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    สินค้า <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- เลือกสินค้า --</option>
                    {masterData?.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.product_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Machine */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    เครื่อง <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedMachine}
                    onChange={(e) => setSelectedMachine(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- เลือกเครื่อง --</option>
                    {masterData?.machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.machine_code} - {m.machine_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Worker */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    พนักงาน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedWorker}
                    onChange={(e) => setSelectedWorker(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- เลือกพนักงาน --</option>
                    {filteredWorkers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.employee_id} - {w.full_name}
                        {w.machines ? ` (${w.machines.machine_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    จำนวน <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="1,200"
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                    <span className="flex items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground">
                      {unitDisplay}
                    </span>
                  </div>
                </div>

                {/* Start Time */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    เวลาเริ่ม
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    เวลาสิ้นสุด
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium">
                  หมายเหตุ
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                  rows={2}
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                  {!showTemplateForm ? (
                    <button
                      onClick={() => setShowTemplateForm(true)}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Plus className="h-4 w-4" />
                      บันทึกเป็น Template
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="ชื่อ Template"
                        className="rounded-lg border bg-background px-3 py-2 text-sm"
                      />
                      <button
                        onClick={handleCreateTemplate}
                        className="rounded-lg bg-[#1A73E8] px-3 py-2 text-sm text-white hover:bg-[#1557b0]"
                      >
                        บันทึก
                      </button>
                      <button
                        onClick={() => {
                          setShowTemplateForm(false);
                          setTemplateName("");
                        }}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSubmitOrder}
                  disabled={sending || !selectedProduct || !selectedMachine || !selectedWorker || !quantity}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-6 py-2 text-sm font-medium text-white hover:bg-[#05b04b] disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "กำลังส่ง..." : "ส่งคำสั่งผลิต"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB 2: TEMPLATES ===== */}
        {activeTab === "templates" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  Template คำสั่งผลิต
                </h2>
                <span className="text-sm text-muted-foreground">
                  กดส่งเพื่อประหยัดเวลา ไม่ต้องกรอกซ้ำ
                </span>
              </div>

              {!templates?.templates.length ? (
                <p className="text-center text-sm text-muted-foreground">
                  ยังไม่มี Template
                  <br />
                  ไปที่แท็บ "สร้างคำสั่งผลิต" แล้วกด "บันทึกเป็น Template"
                </p>
              ) : (
                <div className="grid gap-3">
                  {templates?.templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.template_name}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            สินค้า: {t.products.sku} ({t.products.product_name})
                          </span>
                          <span>จำนวน: {t.planned_quantity.toLocaleString()} {t.products.unit}</span>
                          <span>เครื่อง: {t.machines.machine_code}</span>
                          <span>พนักงาน: {t.workers.full_name}</span>
                        </div>
                        {(t.planned_start_time || t.planned_end_time) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            เวลา: {t.planned_start_time?.slice(0, 5) || "-"} -{" "}
                            {t.planned_end_time?.slice(0, 5) || "-"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSendFromTemplate(t)}
                          disabled={sending}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#06C755] px-3 py-1.5 text-sm text-white hover:bg-[#05b04b] disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" />
                          ส่ง
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(t.id, t.template_name)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB 3: ORDERS ===== */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Active Orders */}
            <div className="rounded-xl border bg-card p-6">
              <h2 className="mb-4 text-base font-semibold">
                คำสั่งผลิตที่กำลังดำเนินการ
              </h2>

              {!activeOrders?.orders.length ? (
                <p className="text-center text-sm text-muted-foreground">
                  ไม่มีคำสั่งผลิตที่กำลังดำเนินการ
                </p>
              ) : (
                <div className="space-y-2">
                  {activeOrders?.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {order.order_number}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          <div className="mt-0.5 text-sm text-muted-foreground">
                            {order.products.product_name} ×{" "}
                            {order.planned_quantity.toLocaleString()}{" "}
                            {order.products.unit}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.machines.machine_code} •{" "}
                            {order.workers.full_name}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div className="rounded-xl border bg-card p-6">
              <h2 className="mb-4 text-base font-semibold">
                คำสั่งผลิตที่เสร็จสิ้น / ยกเลิก
              </h2>

              {!ordersHistory?.orders.length ? (
                <p className="text-center text-sm text-muted-foreground">
                  ยังไม่มีประวัติคำสั่งผลิต
                </p>
              ) : (
                <div className="space-y-2">
                  {ordersHistory?.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {order.order_number}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          <div className="mt-0.5 text-sm text-muted-foreground">
                            {order.products.product_name}
                            {order.production_outputs?.length && (
                              <span className="ml-2 text-green-600">
                                OK: {order.production_outputs[0]!.ok_qty}
                                {order.production_outputs[0]!.ng_qty > 0 && (
                                  <span className="text-red-500">
                                    {" "}
                                    | NG: {order.production_outputs[0]!.ng_qty}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.machines.machine_code} •{" "}
                            {order.workers.full_name}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Suppress unused variable warnings
void Route;
