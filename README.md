# WorkPlannerPro Platform

Platform ใหม่ (Next.js + Tailwind + Supabase) — บริหารงานโครงการ ส่วนตัว เทรด และชีวิต

## วิธีตั้งค่า (ทำครั้งเดียว)

### 1) สร้าง Supabase project
1. ไปที่ https://supabase.com → สมัคร/login → **New project**
2. ตั้งชื่อ + ตั้งรหัส database (จดไว้) → รอสร้างเสร็จ ~2 นาที
3. ไปเมนู **SQL Editor** → New query → วางเนื้อหาจากไฟล์ `supabase/schema.sql` → **Run**
   แล้วรันต่อด้วย `supabase/migrations/002_goals_habits.sql` (ตาราง goals/habits)
   (สร้างตาราง + ระบบสิทธิ์ทั้งหมด)
4. ไปเมนู **Project Settings → API** คัดลอก 2 ค่า:
   - `Project URL`
   - `anon public` key

### 2) ตั้งค่า env
```bash
cd platform
cp .env.local.example .env.local
```
แก้ `.env.local` ใส่ค่าจากขั้นตอน 1.4

### 3) ติดตั้ง + รัน
```bash
npm install
npm run dev
```
เปิด http://localhost:3000 → สมัครสมาชิก → เข้าใช้งาน

> โมดูล **Life Log** + **ส่วนตัว (Goals + Habits)** ใช้งานได้จริงแล้ว (ต่อ Supabase ครบ loop)
> โมดูล โครงการ/เทรด เป็น placeholder รอ port ในเฟสถัดไป

## Deploy (ภายหลัง)
- Netlify/Vercel: ชี้ root ไปที่โฟลเดอร์ `platform/` ตั้ง env 2 ตัวเดียวกัน
- (แนะนำ Vercel เพราะ optimize Next.js ดีที่สุด แต่ Netlify ก็ได้)

## โครงสร้าง
ดู `docs/ARCHITECTURE.md`
