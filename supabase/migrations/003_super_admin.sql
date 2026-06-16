-- ============================================================
-- Migration 003 — Super Admin (บัญชีเดียว เข้า/แก้ได้ทุกโปรเจค)
-- รากของฟีเจอร์ "ID เดียว admin ทุกโครงการ" — แก้ที่ระบบสิทธิ์จริง ไม่ใช่ฮาร์ดโค้ดชื่อ
-- รันต่อจาก schema.sql + 002
-- ============================================================

-- 1) เพิ่ม flag ที่ profile (ระดับบัญชี ไม่ใช่ระดับโปรเจค)
alter table public.profiles add column if not exists is_super_admin boolean default false;

-- 2) helper: บัญชีปัจจุบันเป็น super admin ไหม
create or replace function public.is_super()
returns boolean language sql security definer stable as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

-- 3) อัปเดตสิทธิ์: super admin = สมาชิก + แอดมิน ของ "ทุกโปรเจค" อัตโนมัติ
create or replace function public.is_project_member(pid uuid)
returns boolean language sql security definer stable as $$
  select public.is_super() or exists(
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid()
  ) or exists(
    select 1 from public.projects p
    where p.id = pid and p.owner_id = auth.uid()
  );
$$;

create or replace function public.is_project_admin(pid uuid)
returns boolean language sql security definer stable as $$
  select public.is_super() or exists(
    select 1 from public.projects p
    where p.id = pid and p.owner_id = auth.uid()
  ) or exists(
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- 4) ให้ super admin มองเห็น "ทุกโปรเจค" ในระบบ (ไม่ต้อง join ทีละอัน)
drop policy if exists "projects select" on public.projects;
create policy "projects select" on public.projects
  for select using (public.is_super() or public.is_project_member(id));

-- ============================================================
-- วิธีตั้งบัญชีให้เป็น Super Admin (ทำครั้งเดียวหลังสมัคร):
--   รันใน SQL Editor (แทน you@email.com ด้วยอีเมลที่สมัคร)
--
--   update public.profiles set is_super_admin = true
--   where id = (select id from auth.users where email = 'you@email.com');
--
-- เสร็จแล้ว บัญชีนั้นจะเห็น+แก้ทุกโปรเจคอัตโนมัติ ไม่ต้องตั้ง admin รายโปรเจค
-- ============================================================
