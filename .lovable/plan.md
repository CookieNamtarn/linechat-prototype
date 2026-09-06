# แผนสร้างเว็บแอปแชท LINE OA

เว็บแอปขนาดเล็กสำหรับใช้งานเอง: รับ-ตอบแชทลูกค้าจาก LINE Official Account และส่งข้อความกระจาย (Broadcast) โดยใช้ Lovable Cloud เป็นฐานข้อมูลและฝั่งเซิร์ฟเวอร์

## สิ่งที่จะสร้าง

### 1. หน้า Inbox (หน้าหลัก `/`)
- รายการการสนทนาทางซ้าย (ชื่อผู้ใช้ LINE, ข้อความล่าสุด, เวลา, จุดแจ้งยังไม่อ่าน)
- หน้าต่างแชททางขวา: ดูประวัติข้อความแบบเรียลไทม์ และกล่องพิมพ์ตอบกลับ
- ตอบกลับผ่าน LINE Messaging API (Reply/Push message)

### 2. หน้า Broadcast (`/broadcast`)
- กล่องเขียนข้อความ + ปุ่มส่งหาผู้ติดตามทั้งหมดผ่าน LINE Broadcast API
- ประวัติการส่ง broadcast ย้อนหลัง (ข้อความ, จำนวนผู้รับ, เวลา, สถานะ)

### 3. Webhook รับข้อความจาก LINE
- Endpoint `/api/public/line-webhook` สำหรับรับ event จาก LINE
- ตรวจสอบลายเซ็น X-Line-Signature ด้วย Channel secret ก่อนประมวลผล
- บันทึกข้อความเข้า (ข้อความ, รูป, สติกเกอร์) ลงฐานข้อมูล พร้อมดึงชื่อโปรไฟล์ผู้ส่ง
- อัปเดตหน้าแชทแบบเรียลไทม์ด้วย Supabase Realtime

## รายละเอียดทางเทคนิค

- **Lovable Cloud**: เปิดใช้งานเพื่อมีฐานข้อมูล + รันโค้ดฝั่งเซิร์ฟเวอร์
- **ตารางฐานข้อมูล**:
  - `conversations` — userId ของลูกค้า LINE, ชื่อ, รูปโปรไฟล์, เวลาข้อความล่าสุด
  - `messages` — ข้อความแต่ละขัน (ทิศทาง inbound/outbound, ประเภท, เนื้อหา, เวลา)
  - `broadcasts` — ประวัติการกระจายข้อความ
- ใช้งานเองคนเดียว: ไม่มีระบบล็อกอิน นโยบาย RLS เปิดอ่าน/เขียนได้ (เหมาะสำหรับเครื่องมือส่วนตัว — ถ้าต้องการความปลอดภัยเพิ่ม ค่อยเติมล็อกอินภายหลัง)
- **Secrets ที่ต้องขอจากคุณ** (ผ่านฟอร์มที่ปลอดภัยของ Lovable):
  1. `LINE_CHANNEL_ACCESS_TOKEN` — จาก LINE Developers Console → Messaging API
  2. `LINE_CHANNEL_SECRET` — จาก LINE Developers Console → Basic settings
- **การตั้งค่าฝั่ง LINE**: นำ URL webhook ของแอปไปวางใน LINE Developers Console → Messaging API → Webhook URL แล้วกด Verify + เปิด Use webhook (จะแจ้ง URL ให้ตอนสร้างเสร็จ)

## ขั้นตอนการทำงาน

1. เปิด Lovable Cloud และสร้างตารางฐานข้อมูล 3 ตาราง
2. สร้าง webhook endpoint รับ event จาก LINE พร้อมตรวจลายเซ็น
3. สร้าง server functions สำหรับตอบแชทและส่ง broadcast ผ่าน LINE API
4. สร้างหน้า Inbox (รายการแชท + หน้าต่างสนทนาเรียลไทม์)
5. สร้างหน้า Broadcast พร้อมประวัติการส่ง
6. ขอ Channel access token และ Channel secret จากคุณ แล้วทดสอบส่ง-รับข้อความจริง

หมายเหตุ: การทดสอบรับข้อความจริงต้องตั้งค่า Webhook URL ใน LINE Developers Console ก่อน — จะแนะนำขั้นตอนทีละขั้นตอนตอนเสร็จ
