-- ============================================================
-- WorkPlannerPro Platform — Supabase schema + RLS
-- รันใน Supabase Studio → SQL Editor (ทีเดียวจบ)
-- ============================================================

-- ---------- PROFILES (ผูกกับ auth.users) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  color       text default '#3b82f6',
  created_at  timestamptz default now()
);

-- สร้าง profile อัตโนมัติเมื่อมี user ใหม่
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- PROJECTS ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  type        text default 'project',         -- project | personal
  icon        text default '🏗️',
  color       text default '#3b82f6',
  buildings   jsonb default '[]',
  floors      jsonb default '[]',
  teams       jsonb default '[]',
  categories  jsonb default '[]',
  settings    jsonb default '{}',             -- weekendDays, holidays, inspectionPlan, logo ฯลฯ
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- PROJECT MEMBERS (multi-user + role) ----------
create table if not exists public.project_members (
  project_id  uuid references public.projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  role        text default 'viewer',          -- admin | member | viewer
  team        text,                            -- ทีมที่ผู้ใช้สังกัด (สำหรับกรองงาน)
  joined_at   timestamptz default now(),
  primary key (project_id, user_id)
);

-- helper: เช็คว่าเป็นสมาชิกโครงการไหม (เลี่ยง RLS recursion)
create or replace function public.is_project_member(pid uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid()
  ) or exists(
    select 1 from public.projects p
    where p.id = pid and p.owner_id = auth.uid()
  );
$$;

create or replace function public.is_project_admin(pid uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.projects p
    where p.id = pid and p.owner_id = auth.uid()
  ) or exists(
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- ---------- TASKS ----------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null,
  building      text,
  floor         text,
  team          text,
  category      text,
  start_date    date,
  end_date      date,
  done          boolean default false,
  done_at       timestamptz,
  blocked       boolean default false,
  is_inspection boolean default false,
  inspection_result text,                      -- pass | fail | fixing | pending
  note          text,
  materials     text,
  person_count  int,
  sort_order    int default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_tasks_project on public.tasks(project_id);

-- ---------- TASK PHOTOS ----------
create table if not exists public.task_photos (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  url         text not null,                   -- Supabase Storage URL
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz default now()
);
create index if not exists idx_task_photos_task on public.task_photos(task_id);

-- ---------- PERSONAL TASKS ----------
create table if not exists public.personal_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  priority    text default 'medium',
  due         date,
  note        text,
  repeat      text default 'none',             -- none | daily | weekly | monthly
  done        boolean default false,
  done_at     timestamptz,
  created_at  timestamptz default now()
);
create index if not exists idx_ptasks_user on public.personal_tasks(user_id);

-- ---------- PERSONAL NOTES ----------
create table if not exists public.personal_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  body        text,
  updated_at  timestamptz default now()
);
create index if not exists idx_pnotes_user on public.personal_notes(user_id);

-- ---------- LIFE LOG (schema กลาง 7 หมวด) ----------
create table if not exists public.life_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  log_date    date not null,
  domain      text not null,                   -- finance|work|trading|health|mind|growth|time
  metric      text not null,                   -- sleep|mood|pnl|expense|...
  value       numeric,
  unit        text,
  tags        jsonb default '[]',
  note        text,
  created_at  timestamptz default now(),
  unique (user_id, log_date, metric)           -- 1 ค่า/เมตริก/วัน
);
create index if not exists idx_lifelog_user_date on public.life_log(user_id, log_date);

-- ---------- TRADES (โมดูลเทรด) ----------
create table if not exists public.trades (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  pair          text,                          -- XAUUSD | BTCUSD ...
  direction     text,                          -- long | short
  entry         numeric,
  sl            numeric,
  tp            numeric,
  lot           numeric,
  pnl           numeric,
  setup         text,
  emotion       text,
  followed_plan boolean,
  opened_at     timestamptz,
  closed_at     timestamptz,
  note          text,
  created_at    timestamptz default now()
);
create index if not exists idx_trades_user on public.trades(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks           enable row level security;
alter table public.task_photos     enable row level security;
alter table public.personal_tasks  enable row level security;
alter table public.personal_notes  enable row level security;
alter table public.life_log        enable row level security;
alter table public.trades          enable row level security;

-- profiles: ทุกคนอ่าน profile กันได้ (ชื่อ/สี), แก้ได้เฉพาะตัวเอง
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles update" on public.profiles for update using (id = auth.uid());

-- projects: สมาชิกอ่านได้, owner/admin จัดการได้
create policy "projects select" on public.projects for select using (public.is_project_member(id));
create policy "projects insert" on public.projects for insert with check (owner_id = auth.uid());
create policy "projects update" on public.projects for update using (public.is_project_admin(id));
create policy "projects delete" on public.projects for delete using (owner_id = auth.uid());

-- project_members
create policy "members select" on public.project_members for select using (public.is_project_member(project_id));
create policy "members manage" on public.project_members for all using (public.is_project_admin(project_id)) with check (public.is_project_admin(project_id));

-- tasks: สมาชิกอ่าน, สมาชิก (ไม่ใช่ viewer) แก้ได้ — ที่นี่ให้สมาชิกทุกคนเขียนได้ ตรวจ role ที่ชั้น app
create policy "tasks select" on public.tasks for select using (public.is_project_member(project_id));
create policy "tasks write"  on public.tasks for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

-- task_photos
create policy "photos select" on public.task_photos for select using (
  exists(select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id))
);
create policy "photos write" on public.task_photos for all using (
  exists(select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id))
) with check (
  exists(select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id))
);

-- ข้อมูลส่วนตัว: เห็นเฉพาะของตัวเอง
create policy "ptasks own" on public.personal_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pnotes own" on public.personal_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lifelog own" on public.life_log    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trades own"  on public.trades       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
