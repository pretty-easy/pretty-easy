-- Pretty Easy – מערכת קביעת תורים
-- Migration 0001: schema, functions, RLS

create extension if not exists pgcrypto;

-- ===== Tables =====

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null check (duration_minutes between 5 and 480),
  price numeric(8,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = ראשון
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (starts_at < ends_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  client_name text not null,
  client_phone text not null,
  notes text,
  status text not null default 'confirmed' check (status in ('pending','confirmed','cancelled')),
  cancel_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at),
  -- ההגנה האמיתית מפני תורים כפולים: ברמת ה-DB, גם בלחיצה בו-זמנית
  constraint no_overlap exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);

create index appointments_starts_at_idx on public.appointments (starts_at);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- ===== Trigger: upsert client on booking =====

create or replace function public.upsert_client_from_appointment()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into clients (name, phone)
  values (new.client_name, new.client_phone)
  on conflict (phone) do update set name = excluded.name;
  return new;
end $$;

create trigger appointments_upsert_client
after insert on public.appointments
for each row execute function public.upsert_client_from_appointment();

-- ===== Functions (SECURITY DEFINER – הדרך היחידה של לקוחות לגעת בתורים) =====

-- משבצות פנויות ליום ולטיפול, בשעון ישראל, קפיצות של 30 דק'
create or replace function public.get_available_slots(p_service_id uuid, p_date date)
returns table (slot_start timestamptz, label text)
language plpgsql security definer set search_path = public as $$
declare
  v_duration int;
  v_dow int;
begin
  select duration_minutes into v_duration
  from services where id = p_service_id and is_active;
  if v_duration is null then
    return;
  end if;

  v_dow := extract(dow from p_date);

  return query
  select
    (gs at time zone 'Asia/Jerusalem') as slot_start,
    to_char(gs, 'HH24:MI') as label
  from working_hours wh
  cross join lateral generate_series(
    p_date + wh.start_time,
    p_date + wh.end_time - make_interval(mins => v_duration),
    interval '30 minutes'
  ) gs
  where wh.day_of_week = v_dow
    and (gs at time zone 'Asia/Jerusalem') > now()
    and not exists (
      select 1 from blocked_times b
      where tstzrange(b.starts_at, b.ends_at) &&
            tstzrange((gs at time zone 'Asia/Jerusalem'),
                      (gs at time zone 'Asia/Jerusalem') + make_interval(mins => v_duration))
    )
    and not exists (
      select 1 from appointments a
      where a.status <> 'cancelled'
        and tstzrange(a.starts_at, a.ends_at) &&
            tstzrange((gs at time zone 'Asia/Jerusalem'),
                      (gs at time zone 'Asia/Jerusalem') + make_interval(mins => v_duration))
    )
  order by 1;
end $$;

-- קביעת תור: מאמתת שהמשבצת באמת פנויה ובתוך שעות העבודה
create or replace function public.book_appointment(
  p_service_id uuid,
  p_slot_start timestamptz,
  p_name text,
  p_phone text,
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_duration int;
  v_id uuid;
  v_token text;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'נא למלא שם';
  end if;
  if p_phone !~ '^0\d{1,2}-?\d{7}$' then
    raise exception 'מספר טלפון לא תקין';
  end if;

  select duration_minutes into v_duration
  from services where id = p_service_id and is_active;
  if v_duration is null then
    raise exception 'הטיפול לא נמצא';
  end if;

  -- המשבצת חייבת להיות אחת מהמשבצות הפנויות המוצעות
  if not exists (
    select 1 from get_available_slots(
      p_service_id,
      (p_slot_start at time zone 'Asia/Jerusalem')::date
    ) g where g.slot_start = p_slot_start
  ) then
    raise exception 'המועד כבר לא פנוי, נא לבחור שעה אחרת';
  end if;

  insert into appointments (service_id, starts_at, ends_at, client_name, client_phone, notes)
  values (
    p_service_id,
    p_slot_start,
    p_slot_start + make_interval(mins => v_duration),
    trim(p_name),
    replace(p_phone, '-', ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id, cancel_token into v_id, v_token;

  return jsonb_build_object('id', v_id, 'cancel_token', v_token);
exception
  when exclusion_violation then
    raise exception 'המועד נתפס ממש עכשיו, נא לבחור שעה אחרת';
end $$;

-- פרטי תור לפי טוקן (לדף הביטול) – בלי לחשוף כלום מעבר
create or replace function public.get_appointment_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'service_name', s.name,
    'starts_at', a.starts_at,
    'client_name', a.client_name,
    'status', a.status
  ) into v
  from appointments a join services s on s.id = a.service_id
  where a.cancel_token = p_token;
  return v; -- null אם לא נמצא
end $$;

-- ביטול תור לפי טוקן (רק תורים עתידיים)
create or replace function public.cancel_appointment(p_token text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update appointments
  set status = 'cancelled'
  where cancel_token = p_token
    and status <> 'cancelled'
    and starts_at > now();
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

-- ===== RLS =====

alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.blocked_times enable row level security;
alter table public.appointments enable row level security;
alter table public.clients enable row level security;

-- לקוחות (anon): רואות רק טיפולים פעילים ושעות עבודה. שום דבר אחר.
create policy "anon read active services" on public.services
  for select to anon using (is_active);
create policy "anon read working hours" on public.working_hours
  for select to anon using (true);

-- אחותך (authenticated): גישה מלאה להכל
create policy "admin full services" on public.services
  for all to authenticated using (true) with check (true);
create policy "admin full working_hours" on public.working_hours
  for all to authenticated using (true) with check (true);
create policy "admin full blocked_times" on public.blocked_times
  for all to authenticated using (true) with check (true);
create policy "admin full appointments" on public.appointments
  for all to authenticated using (true) with check (true);
create policy "admin full clients" on public.clients
  for all to authenticated using (true) with check (true);

-- פונקציות: פתוחות גם לאנונימיות (הן בודקות הכל בעצמן)
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.get_appointment_by_token(text) to anon, authenticated;
grant execute on function public.cancel_appointment(text) to anon, authenticated;

-- ===== Seed data =====

insert into public.services (name, duration_minutes, price) values
  ('לק ג''ל', 60, 120),
  ('בניית ציפורניים', 120, 250),
  ('מילוי', 90, 180),
  ('הסרה', 30, 50),
  ('לק ג''ל ברגליים', 60, 140);

-- ראשון–חמישי 9:00–19:00, שישי 8:00–13:00
insert into public.working_hours (day_of_week, start_time, end_time) values
  (0, '09:00', '19:00'),
  (1, '09:00', '19:00'),
  (2, '09:00', '19:00'),
  (3, '09:00', '19:00'),
  (4, '09:00', '19:00'),
  (5, '08:00', '13:00');
