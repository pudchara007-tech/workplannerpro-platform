-- ============================================================
-- Migration 006 — Supabase Storage (รูปภาพ) + คอลัมน์รูป/โลโก้
-- รันใน Supabase SQL Editor
-- ============================================================

-- 1) bucket สาธารณะสำหรับรูป
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- 2) policy: อ่านได้ทุกคน, อัป/ลบได้เฉพาะคน login
drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "photos auth insert" on storage.objects;
create policy "photos auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "photos auth delete" on storage.objects;
create policy "photos auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- 3) คอลัมน์เก็บรูป + โลโก้
alter table public.tasks add column if not exists photos jsonb default '[]';
alter table public.projects add column if not exists logo text;
