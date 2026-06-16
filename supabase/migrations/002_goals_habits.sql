-- ============================================================
-- Migration 002 — Goals + Habits (โมดูล Personal)
-- รันใน Supabase Studio → SQL Editor (ต่อจาก schema.sql)
-- ============================================================

-- ---------- GOALS ----------
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  domain        text,                            -- finance|work|trading|health|mind|growth|time
  target_value  numeric,
  current_value numeric default 0,
  unit          text,
  due_date      date,
  status        text default 'active',           -- active | done | paused
  sort_order    int default 0,
  created_at    timestamptz default now()
);
create index if not exists idx_goals_user on public.goals(user_id);

-- ---------- HABITS ----------
create table if not exists public.habits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  icon            text default 'ti-circle-check',
  cadence         text default 'daily',          -- daily | weekly
  target_per_week int default 7,
  archived        boolean default false,
  sort_order      int default 0,
  created_at      timestamptz default now()
);
create index if not exists idx_habits_user on public.habits(user_id);

-- ---------- HABIT LOGS (เช็คนิสัยรายวัน) ----------
create table if not exists public.habit_logs (
  id        uuid primary key default gen_random_uuid(),
  habit_id  uuid not null references public.habits(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  log_date  date not null,
  done      boolean default true,
  unique (habit_id, log_date)
);
create index if not exists idx_habitlogs_user_date on public.habit_logs(user_id, log_date);

-- ---------- RLS ----------
alter table public.goals      enable row level security;
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

create policy "goals own"      on public.goals      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habits own"     on public.habits     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habitlogs own"  on public.habit_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
