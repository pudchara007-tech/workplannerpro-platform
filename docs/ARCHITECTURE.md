# WorkPlannerPro Platform — สถาปัตยกรรม

> เป้าหมาย: ยกระดับจาก single-file static app → **platform จริง** (database, multi-user/login, UI โปร, นำทางชัด)

---

## Stack

| ชั้น | เทคโนโลยี | ทำหน้าที่ |
|------|-----------|-----------|
| Frontend | **Next.js (App Router) + TypeScript** | หน้าเว็บ, routing, server components |
| Styling | **Tailwind CSS** | ดีไซน์ระบบ, UI โปร, theme เดียวทั้งแอป |
| Backend/DB | **Supabase (Postgres)** | ฐานข้อมูลจริง |
| Auth | **Supabase Auth** | สมัคร/login (email+password, ขยายเป็น Google ได้) |
| Security | **Row Level Security (RLS)** | ผู้ใช้เห็นเฉพาะข้อมูลตัวเอง/โครงการที่เป็นสมาชิก |
| Realtime | **Supabase Realtime** | sync สดระหว่างเครื่อง (แทน polling เดิม) |
| Deploy | **Netlify / Vercel** | host frontend |

---

## โครงสร้างโฟลเดอร์

```
platform/
├─ app/
│  ├─ (auth)/login/page.tsx        # หน้า login
│  ├─ (auth)/signup/page.tsx       # หน้าสมัคร
│  ├─ (app)/layout.tsx             # App shell (sidebar + topbar)
│  ├─ (app)/page.tsx               # หน้า Home / ภาพรวม
│  ├─ (app)/projects/...           # โมดูลโครงการ
│  ├─ (app)/personal/...           # โมดูลงานส่วนตัว
│  ├─ (app)/trading/...            # โมดูลเทรด
│  ├─ (app)/life/page.tsx          # โมดูล Life Log
│  ├─ layout.tsx                   # root layout
│  └─ globals.css
├─ components/                     # UI components ใช้ซ้ำ
├─ lib/
│  ├─ supabase/client.ts           # browser client
│  ├─ supabase/server.ts           # server client (SSR)
│  └─ types.ts                     # TypeScript types ตรงกับ DB
├─ supabase/schema.sql             # DB schema + RLS
├─ middleware.ts                   # ป้องกัน route ที่ต้อง login
├─ .env.local.example
└─ package.json
```

---

## โมดูล (แก้ปัญหา "ทุกอย่างผูกกับโครงการ" + "นำทางสับสน")

App shell มี **sidebar เดียว** สลับ 4 โมดูลอิสระ:

- 🏗️ **โครงการ (Projects)** — งานก่อสร้าง/ส่งตรวจ (ของเดิม KARON ฯลฯ) รองรับหลายโครงการ + ทีม + สิทธิ์
- ☀️ **ส่วนตัว (Personal)** — งานส่วนตัว, ปฏิทิน, บันทึก
- 📈 **เทรด (Trading)** — trade journal, สถิติ, backtest
- 📊 **Life Log** — บันทึกชีวิต 7 หมวด + วิเคราะห์

แต่ละโมดูลเป็นหน้าแยก ไม่ขึ้นต่อกัน → เพิ่ม/แก้ทีละส่วนได้

---

## แผนเป็นเฟส

| เฟส | งาน | สถานะ |
|-----|-----|-------|
| **0** | สถาปัตยกรรม + DB schema | 🚧 กำลังทำ |
| **1** | Scaffold Next.js + Auth + App shell | 🚧 |
| **2** | โมดูล Life Log ต่อ DB จริง (proof of stack) | 🚧 |
| **3** | โมดูลโครงการ + ทีม + สิทธิ์ (port จากของเดิม) | ⏳ |
| **4** | โมดูลส่วนตัว + เทรด | ⏳ |
| **5** | **Migration** — ย้ายข้อมูลเดิมทั้งหมดเข้า Supabase | ⏳ |
| **6** | Realtime sync + ขัดเกลา UI + deploy | ⏳ |

---

## แผน Migration ข้อมูลเดิม (เฟส 5)

ข้อมูลเดิมอยู่ใน Google Drive (ผ่าน Apps Script) เป็น JSON ต่อโครงการ:

1. Export JSON ทุกโครงการจากแอปเดิม (มีปุ่ม Export อยู่แล้ว)
2. เขียนสคริปต์ import: อ่าน JSON → map เข้าตาราง Supabase (projects, tasks, task_photos, ...)
3. รูปภาพ (base64 ปัจจุบัน) → อัป Supabase Storage แล้วเก็บ URL แทน (ลดขนาด DB)
4. ตรวจสอบจำนวน record ตรงกับของเดิม

> ของเดิมยังเปิดใช้ได้ระหว่างทำ platform ใหม่ — ตัดสลับเมื่อพร้อม

---

## หลักการดีไซน์ใหม่

- **Design tokens** เดียว (สี/ระยะ/เงา) ผ่าน Tailwind config → ทั้งแอปสม่ำเสมอ
- Sidebar + topbar คงที่, content เปลี่ยนตามโมดูล
- Responsive (มือถือ = sidebar ยุบ)
- Dark mode เป็นค่าเริ่มต้น (ตามของเดิม) แต่สลับ light ได้
