begin;

create table app_private.site_visit_receipts(
 viewer_id uuid primary key references auth.users(id) on delete cascade,
 last_counted_on date not null
);
create table app_private.site_visit_days(
 visit_date date primary key,
 visits bigint not null check(visits>=0)
);
revoke all on app_private.site_visit_receipts,app_private.site_visit_days from public,anon,authenticated,service_role;

create function public.site_visit_stats() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare today date=(current_timestamp at time zone 'Asia/Seoul')::date;
begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 return jsonb_build_object('date',today,
  'today',coalesce((select visits from app_private.site_visit_days where visit_date=today),0),
  'peak',coalesce((select max(visits) from app_private.site_visit_days),0),
  'total',coalesce((select sum(visits) from app_private.site_visit_days),0));
end $$;

create function public.record_site_visit() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid=auth.uid(); today date=(current_timestamp at time zone 'Asia/Seoul')::date;
begin
 if actor is null or public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 insert into app_private.site_visit_receipts(viewer_id,last_counted_on) values(actor,today)
 on conflict(viewer_id) do update set last_counted_on=excluded.last_counted_on
 where app_private.site_visit_receipts.last_counted_on<excluded.last_counted_on;
 if found then
  insert into app_private.site_visit_days(visit_date,visits) values(today,1)
  on conflict(visit_date) do update set visits=app_private.site_visit_days.visits+1;
 end if;
 return public.site_visit_stats();
end $$;

revoke all on function public.site_visit_stats(),public.record_site_visit() from public,anon,authenticated;
grant execute on function public.site_visit_stats(),public.record_site_visit() to authenticated;

commit;
