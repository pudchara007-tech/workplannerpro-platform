-- ============================================================
-- Migration 004 — เพิ่ม field โครงสร้างงานส่งตรวจ (สำหรับ matrix)
-- รันใน Supabase SQL Editor
-- ============================================================
alter table public.tasks add column if not exists zone_id     text;
alter table public.tasks add column if not exists zone_name   text;
alter table public.tasks add column if not exists zone_type   text;   -- common | room
alter table public.tasks add column if not exists room_number text;
alter table public.tasks add column if not exists system      text;   -- lighting | socket-comm | ...
alter table public.tasks add column if not exists system_name text;

create index if not exists idx_tasks_insp on public.tasks(project_id, is_inspection);
