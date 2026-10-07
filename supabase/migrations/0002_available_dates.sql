-- כמה משבצות פנויות יש בכל יום בטווח – כדי להשבית ימים מלאים בבחירת התאריך
create or replace function public.get_available_dates(p_service_id uuid, p_from date, p_days int default 21)
returns table(day date, free_count bigint)
language sql security definer set search_path = public as $$
  select d::date as day, count(s.slot_start) as free_count
  from generate_series(p_from, p_from + (p_days - 1), interval '1 day') d
  left join lateral public.get_available_slots(p_service_id, d::date) s on true
  group by d::date
  order by d::date;
$$;

grant execute on function public.get_available_dates(uuid, date, int) to anon, authenticated;
