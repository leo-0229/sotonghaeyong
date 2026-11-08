begin;
-- Two L5 operator accounts are allowed during the pilot; L1-L4 retain one each.
alter table app_private.pilot_account_slots drop constraint pilot_account_slots_pkey;
alter table app_private.pilot_account_slots add primary key(user_id);
create unique index pilot_single_lower_level on app_private.pilot_account_slots(level) where level < 5;

create or replace function public.initialize_provisioned_account(p_user uuid,p_name text,p_student_id text,p_gender text,p_role text default 'STUDENT',p_position text default null,p_issuer uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_level int;begin
 perform pg_advisory_xact_lock(20261108,4);
 select level into target_level from public.roles where code=p_role;
 if target_level is null then raise exception 'INVALID_ROLE';end if;
 if (select count(*) from app_private.pilot_account_slots where level=target_level)>=(case when target_level=5 then 2 else 1 end) then raise exception 'PILOT_LEVEL_LIMIT';end if;
 perform app_private.initialize_provisioned_account(p_user,p_name,p_student_id,p_gender,p_role,p_position,p_issuer);
 insert into app_private.pilot_account_slots(level,user_id) values(target_level,p_user);
end $$;

create or replace function app_private.check_pilot_role() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_level int;begin
 perform pg_advisory_xact_lock(20261108,4);
 if exists(select 1 from app_private.pilot_account_slots where user_id=new.user_id) then
  select level into target_level from public.roles where code=new.role_code;
  if (select count(*) from app_private.pilot_account_slots where level=target_level and user_id<>new.user_id)>=(case when target_level=5 then 2 else 1 end) then raise exception 'PILOT_LEVEL_LIMIT';end if;
  update app_private.pilot_account_slots set level=target_level where user_id=new.user_id;
 end if;
 return new;
end $$;
revoke all on function app_private.check_pilot_role() from public,anon,authenticated,service_role;
revoke all on function public.initialize_provisioned_account(uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.initialize_provisioned_account(uuid,text,text,text,text,text,uuid) to service_role;
commit;
