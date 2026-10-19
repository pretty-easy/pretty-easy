-- 0013: ends_at באזור האישי (לאירוע יומן גוגל באורך נכון)
-- *** כבר הוחלה על ה-DB ע"י Claude – לתיעוד בלבד ***
create or replace function public.get_my_appointments(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_name text;
  v jsonb;
begin
  select client_phone, client_name into v_phone, v_name
  from appointments where cancel_token = p_token;
  if v_phone is null then
    return null;
  end if;

  select jsonb_build_object(
    'client_name', v_name,
    'appointments', coalesce(jsonb_agg(
      jsonb_build_object(
        'cancel_token', a.cancel_token,
        'service_name', s.name,
        'price', s.price,
        'price_max', s.price_max,
        'addons', a.addons,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'status', a.status,
        'is_past', a.starts_at < now()
      ) order by a.starts_at desc
    ), '[]'::jsonb)
  ) into v
  from appointments a
  join services s on s.id = a.service_id
  where a.client_phone = v_phone;

  return v;
end $$;
