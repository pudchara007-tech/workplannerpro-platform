-- ============================================================
-- Migration 005 — วันที่ส่งตรวจ (completed / scheduled)
-- รันใน Supabase SQL Editor
-- ============================================================
alter table public.tasks add column if not exists insp_completed date;
alter table public.tasks add column if not exists insp_scheduled date;
