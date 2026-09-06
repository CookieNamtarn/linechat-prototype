# Planner Guide — ส่งคำสั่งผลิตเข้า LINE OA ง่ายๆ

> **เป้าหมาย**: Planner ไม่ต้องพิมพ์ Flex Message, JSON, หรือฟอร์แมตใดๆ แค่กรอกฟอร์มหรือพิมพ์คำสั่งสั้นๆ ระบบจะจัดการทั้งหมด

---

## แนวทางที่ 1: Web Form แบบ Dropdown (แนะนำ)

### หน้าตาฟอร์ม (Planner Dashboard)

```
┌─────────────────────────────────────────────────────┐
│  📋 สร้างคำสั่งผลิต                    [Planner Name] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  สินค้า   [▼ Product A                     ]        │
│                                                     │
│  เครื่อง  [▼ Machine-01                    ]        │
│                                                     │
│  พนักงาน [▼ สมชาย ใจดี (Machine-01)       ]        │
│                                                     │
│  จำนวน   [  1,200  ] pcs                           │
│                                                     │
│  เวลาวางแผน                                         │
│  เริ่ม   [08:00]  สิ้นสุด [16:00]                    │
│                                                     │
│  หมายเหตุ [___________________________]             │
│                                                     │
│           [ ▶ ส่งคำสั่งผลิต ]                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### ข้อดี
- **ไม่ต้องจำรหัส** — เลือกจาก Dropdown ที่ดึงจากฐานข้อมูล
- **ไม่ต้องพิมพ์ฟอร์แมต** — ระบบแปลงเป็น Flex Message ให้อัตโนมัติ
- **Auto-fill** — เลือกเครื่องแล้วพนักงานที่อยู่เครื่องนั้น filter มาให้
- **Default values** — เวลาเริ่ม/สิ้นสุด default ตาม shift

### ข้อมูลที่ Planner ต้องกรอก

| ฟิลด์ | แหล่งข้อมูล | ตัวอย่าง |
|---|---|---|
| สินค้า | Dropdown จากตาราง `products` | Product A |
| เครื่อง | Dropdown จากตาราง `machines` | Machine-01 |
| พนักงาน | Dropdown (filter ตามเครื่องที่เลือก) | สมชาย ใจดี |
| จำนวน | พิมพ์ตัวเลข | 1,200 |
| เวลาเริ่ม/สิ้นสุด | Time picker (default ตาม shift) | 08:00 / 16:00 |
| หมายเหตุ | พิมพ์ข้อความ (optional) | ด่วน! ส่งโดย 14:00 |

---

## แนวทางที่ 2: Smart Text Command (พิมพ์สั่งงานแบบแชท)

### หน้าตาฟอร์ม (Chat Command)

```
┌─────────────────────────────────────────────────────┐
│  💬 สั่งงานด่วน                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [สินค้า เครื่อง จำนวน พนักงาน                    ] │
│                                                     │
│  ตัวอย่าง:                                          │
│  • producta m01 1200 somchai                        │
│  • m01 500 somchai                                  │
│  • productb 2000                                    │
│                                                     │
│           [ ▶ ส่งคำสั่ง ]                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### รูปแบบคำสั่ง

```
สินค้า เครื่อง จำนวน พนักงาน
```

### ตัวอย่างคำสั่ง

| คำสั่ง | ผลลัพธ์ |
|---|---|
| `producta m01 1200 somchai` | ส่ง Product A เครื่อง 01 จำนวน 1,200 ให้สมชาย |
| `m01 500 somchai` | ส่งสินค้าล่าสุดบนเครื่อง 01 จำนวน 500 ให้สมชาย |
| `productb 2000` | ส่ง Product B จำนวน 2,000 ให้พนักงานเครื่อง default |
| `m02 800 @สมศรี` | ส่งสินค้าล่าสุดบนเครื่อง 02 จำนวน 800 ให้สมศรี |

### Parser Logic (อยู่ใน Server Function)

```typescript
// ตัวอย่าง parser แบบง่าย
function parseCommand(input: string) {
  const tokens = input.trim().split(/\s+/);
  
  // หา pattern ของแต่ละ token
  const product = tokens.find(t => t.match(/^product/i));  // "producta"
  const machine = tokens.find(t => t.match(/^m\d+/i));     // "m01"
  const quantity = tokens.find(t => /^\d+$/.test(t));      // "1200"
  const worker = tokens.find(t => t.startsWith('@') || /^[ก-๙]/.test(t)); // "somchai"
  
  // แปรงเป็น ID จากฐานข้อมูล
  // ถ้าไม่ระบุสินค้า → ใช้สินค้าล่าสุดของเครื่องนั้น
  // ถ้าไม่ระบุพนักงาน → ใช้พนักงาน default ของเครื่อง
  
  return { productId, machineId, quantity, workerId };
}
```

---

## แนวทางที่ 3: Template สำเร็จรุป (One-Click)

### หน้าตาฟอร์ม

```
┌─────────────────────────────────────────────────────┐
│  📋 Template คำสั่งผลิต                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ▼ เลือก Template:                                  │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🔵 รอบเช้า - Product A เครื่อง 01            │    │
│  │    สินค้า: Product A | จำนวน: 1,200          │    │
│  │    เครื่อง: Machine-01 | พนักงาน: สมชาย     │    │
│  │                              [ ▶ ส่งเลย ]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🟢 รอบบ่าย - Product B เครื่อง 02            │    │
│  │    สินค้า: Product B | จำนวน: 800            │    │
│  │    เครื่อง: Machine-02 | พนักงาน: สมศรี      │    │
│  │                              [ ▶ ส่งเลย ]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [ + สร้าง Template ใหม่ ]                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### ข้อดี
- **1 คลิก** — ไม่ต้องกรอกอะไรเลย (แก้จำนวนได้ถ้าต้องการ)
- **Repeatable** — งานที่ส่งซ้ำทุกวันเก็บเป็น Template
- **ไม่มี Error** — Template ถูกต้องแล้ว กดส่งได้เลย

---

## แนวทางที่ 4: Import จาก Excel/Google Sheets

### กรณี Planner วางแผนล่วงหน้าเป็นชุด

```
วันที่     | สินค้า   | เครื่อง | จำนวน | พนักงาน
───────────┼──────────┼────────┼───────┼────────
2026-09-07 | ProductA | M01    | 1200  | สมชาย
2026-09-07 | ProductB | M02    | 800   | สมศรี
2026-09-07 | ProductA | M01    | 1500  | สมหมาย
2026-09-08 | ProductC | M03    | 500   | สมชาย
```

### วิธีทำ

1. Planner กรอกใน Google Sheets ตามตารางปกติ
2. กดปุ่ม "ส่งคำสั่งผลิต" (เชื่อมกับ Apps Script)
3. ระบบอ่านข้อมูล + ตรวจสอบ + ส่ง Flex Message ให้ทุกแถว

### Apps Script (แนวคิด)

```javascript
function sendProductionOrders() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // ข้อมูลเริ่มจากแถวที่ 2 (แถวแรกเป็น header)
  for (let i = 1; i < data.length; i++) {
    const [date, product, machine, qty, worker] = data[i];
    
    // เรียก API ของแอพเรา
    UrlFetchApp.fetch("https://linechat-prototype.lovable.app/api/production/batch", {
      method: "POST",
      headers: { "Authorization": "Bearer " + API_TOKEN },
      payload: JSON.stringify({ date, product, machine, qty, worker })
    });
  }
}
```

---

## แนวทางที่ 5: LINE Bot Command (สั่งผ่าน LINE เลย)

### Planner พิมพ์ใน LINE OA ได้เลย

```
/new ProductA M01 1200 @สมชาย
/new ProductB M02 800
/status M01          ← ดูสถานะเครื่อง
/list                ← ดูคำสั่งวันนี้
/cancel ORDER-001    ← ยกเลิกคำสั่ง
```

### ข้อดี
- **ไม่ต้องเปิดหน้าเว็บ** — พิมพ์ใน LINE ได้เลย
- **ทำได้จากทุกที่** — มือถือ หรือ Desktop LINE
- **ทันที** — ส่งได้ทันทีขณะ Walk รอบโรงงาน

---

## เปรียบเทียบ 5 แนวทาง

| แนวทาง | ความง่าย | ความเร็ว | เหมาะกับ | ต้อง Build |
|---|---|---|---|---|
| **1. Web Form Dropdown** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ใช้ประจำทุกวัน | ฟอร์งเพิ่ม 1 หน้า |
| **2. Smart Text Command** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | สั่งด่วนขณะ Walk | Parser + validate |
| **3. Template One-Click** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | งาน Repeat ทุกวัน | Template table + UI |
| **4. Import from Sheets** | ⭐⭐⭐ | ⭐⭐ | วางแผนล่วงหน้าทั้งสัปดาห์ | Sheets + API |
| **5. LINE Bot Command** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | สั่งจากทุกที่ ไม่เปิดเว็บ | Webhook + Parser |

---

## แนะนำ: เริ่มจากแนวทาง 1 + 3 ก่อน

### Phase 1 (สัปดาห์แรก)
```
Planner Web Form (Dropdown) → รับข้อมูล → ส่ง Flex Message → Worker ได้รับ
```

### Phase 2 (สัปดาห์ที่ 2)
```
Template System → บันทึกคำสั่งที่ใช้บ่อย → 1 คลิกส่งได้
```

### Phase 3 (ต่อไป)
```
LINE Bot Command → สั่งผ่าน LINE ได้เลย → ไม่ต้องเปิดเว็บ
```

---

## Technical Implementation (สรุป)

### Server Function: createProductionOrder

```typescript
// รับ input จากฟอร์มใดๆ ก็ได้
export const createProductionOrder = createServerFn({ method: "POST" })
  .inputValidator((data: {
    productId: string;      // จาก Dropdown
    machineId: string;      // จาก Dropdown
    workerId: string;       // จาก Dropdown
    plannedQuantity: number; // จาก Input
    plannedStartTime?: string; // จาก Time Picker
    plannedEndTime?: string;   // จาก Time Picker
    notes?: string;          // จาก Textarea
  }) => { /* validate */ })
  .handler(async ({ data }) => {
    // 1. สร้าง Order ใน Database
    // 2. ดึงข้อมูล Product, Machine, Worker
    // 3. สร้าง Flex Message JSON อัตโนมัติ
    // 4. ส่งผ่าน LINE Push API
    // 5. ส่ง Response กลับว่าสำเร็จ
  });
```

### สิ่งที่ระบบทำให้อัตโนมัติ (Planner ไม่ต้องสน)

| สิ่งที่เกิดขึ้น | ระบบจัดการเอง |
|---|---|
| สร้าง Order Number | Auto-generate (เช่น `ORD-20260907-001`) |
| แปลงข้อมูลเป็น Flex Message | `buildAssignedFlexMessage()` |
| ดึง LINE User ID จากชื่อพนักงาน | Query ตาราง `workers` |
| ส่งผ่าน LINE API | `sendFlexMessage()` |
| Handle Error ถ้าส่งไม่สำเร็จ | Retry + Log + แจ้ง Planner |

---

## ตัวอย่าง Flow ที่ Planner เห็น

### ขั้นตอน (3 ขั้นตอน 30 วินาที)

```
ขั้นที่ 1: เลือกข้อมูล (10 วิ)
┌──────────────────────────────────────┐
│ สินค้า  [▼ Product A              ]  │
│ เครื่อง [▼ Machine-01             ]  │
│ พนักงาน[▼ สมชาย (Auto-selected)  ]  │
│ จำนวน  [  1,200  ] pcs              │
└──────────────────────────────────────┘

ขั้นที่ 2: กดส่ง (1 วิ)
┌──────────────────────────────────────┐
│           [ ▶ ส่งคำสั่งผลิต ]         │
└──────────────────────────────────────┘

ขั้นที่ 3: สำเร็จ (19 วิ)
┌──────────────────────────────────────┐
│ ✅ ส่งคำสั่งผลิตสำเร็จ                │
│                                      │
│ ORD-20260907-001                     │
│ Product A × 1,200 pcs                │
│ Machine-01 → สมชาย                   │
│                                      │
│ พนักงานได้รับข้อความใน LINE แล้ว      │
└──────────────────────────────────────┘
```

### สิ่งที่ Planner ไม่ต้องทำ

❌ ไม่ต้องพิมพ์ JSON
❌ ไม่ต้องจำ LINE User ID
❌ ไม่ต้องเปิด Developer Console
❌ ไม่ต้องกังวลเรื่องฟอร์แมต
❌ ไม่ต้องส่งข้อความ LINE เอง

---

## สรุป

> **Planner แค่บอก "อะไร กี่ชิ้น ใครทำ เครื่องไหน" ระบบจัดการทั้งหมด**

ทั้ง 5 แนวทางต่างก็ไปสู่ **Server Function ตัวเดียวกัน** (`createProductionOrder`) — ต่างกันแค่ **Input Method** ที่ Planner ใช้

**เริ่มจาก Web Form (แนวทาง 1)** เพราะ:
- ทำเร็วที่สุด (1 วัน)
- Planner เข้าใจง่าย
- ข้อมูลถูก validate ก่อดส่ง
- เพิ่ม Template ได้ในภายหลัง
