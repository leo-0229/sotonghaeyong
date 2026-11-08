begin;
-- Remove numeric-level quotas. Keep the historical private slot table for auditability.
drop trigger check_pilot_role on public.user_roles;
create or replace function public.initialize_provisioned_account(p_user uuid,p_name text,p_student_id text,p_gender text,p_role text default 'STUDENT',p_position text default null,p_issuer uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform app_private.initialize_provisioned_account(p_user,p_name,p_student_id,p_gender,p_role,p_position,p_issuer);
end $$;

create table app_private.temporary_account_credentials(
 user_id uuid primary key references auth.users(id) on delete cascade,
 sealed_password text not null check(octet_length(sealed_password) between 20 and 8192),
 created_at timestamptz not null default now()
);
revoke all on app_private.temporary_account_credentials from public,anon,authenticated,service_role;

create function public.store_temporary_credential(p_user uuid,p_sealed text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform 1 from public.profiles where id=p_user and credentials_pending and status='ACTIVE' for update;
 if not found then raise exception 'TEMPORARY_ACCOUNT_REQUIRED';end if;
 insert into app_private.temporary_account_credentials(user_id,sealed_password) values(p_user,p_sealed)
 on conflict(user_id) do update set sealed_password=excluded.sealed_password,created_at=now();
end $$;
revoke all on function public.store_temporary_credential(uuid,text) from public,anon,authenticated;
grant execute on function public.store_temporary_credential(uuid,text) to service_role;

create function public.pending_temporary_credentials() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()<>5 then raise exception 'L5_REQUIRED';end if;
 insert into public.audit_logs(actor_id,action) values(auth.uid(),'account.temporary_credentials_viewed');
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'studentId',p.student_id,'loginId',p.login_id,'role',r.role_code,'sealed',v.sealed_password) order by p.display_name)
 from public.profiles p join public.user_roles r on r.user_id=p.id
 join app_private.temporary_account_credentials v on v.user_id=p.id
 where p.credentials_pending and p.status='ACTIVE'),'[]'::jsonb);
end $$;
revoke all on function public.pending_temporary_credentials() from public,anon;
grant execute on function public.pending_temporary_credentials() to authenticated;

create function app_private.erase_completed_temporary_credential() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not new.credentials_pending or new.status<>'ACTIVE' then
  delete from app_private.temporary_account_credentials where user_id=new.id;
 end if;
 return new;
end $$;
revoke all on function app_private.erase_completed_temporary_credential() from public,anon,authenticated,service_role;
create trigger erase_completed_temporary_credential after update of credentials_pending,status on public.profiles
 for each row execute function app_private.erase_completed_temporary_credential();
create or replace function app_private.initialize_provisioned_account(p_user uuid,p_name text,p_student_id text,p_gender text,p_role text default 'STUDENT',p_position text default null,p_issuer uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare email_value text; username text; cls uuid; grade_value int; room_value int; begin
 if char_length(btrim(p_name)) not between 2 and 30 or p_name is null then raise exception 'INVALID_NAME';end if;
 if p_role not in ('STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER') or p_role is null then raise exception 'INVALID_ROLE';end if;
 if p_issuer is not null and (not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_issuer and p.status='ACTIVE' and not p.credentials_pending and r.role_code='SUPERVISING_TEACHER')) then raise exception 'TEACHER_REQUIRED';end if;
 select email into email_value from auth.users where id=p_user;username=split_part(email_value,'@',1);
 if email_value is null or email_value<>username||'@accounts.mpms.invalid' or username!~'^tmp_[a-z0-9_]{4,20}$' then raise exception 'TEMPORARY_AUTH_USER_REQUIRED';end if;
 if p_role<>'SUPERVISING_TEACHER' then
  if p_student_id is null or p_student_id!~'^[1-3](0[1-9]|[12][0-9]|30)(0[1-9]|[1-9][0-9])$' or p_gender is null or p_gender not in ('MALE','FEMALE') then raise exception 'VERIFIED_STUDENT_ID_AND_GENDER_REQUIRED';end if;
  grade_value=left(p_student_id,1)::int;room_value=substring(p_student_id from 2 for 2)::int;
  insert into public.school_classes(school_year,grade,room) values(extract(year from now() at time zone 'Asia/Seoul')::int,grade_value,room_value) on conflict(school_year,grade,room) do update set room=excluded.room returning id into cls;
 end if;
 if exists(select 1 from public.profiles where id=p_user and login_id is not null) then raise exception 'ACCOUNT_ALREADY_INITIALIZED';end if;
 update public.profiles set display_name=btrim(p_name),student_id=p_student_id,gender=p_gender,class_id=cls,login_id=username,credentials_pending=true,status='ACTIVE',credential_version=0 where id=p_user;
 if not found then raise exception 'PROFILE_REQUIRED';end if;
 update public.user_roles set role_code=p_role,granted_by=p_issuer where user_id=p_user;
 if p_role='CLASS_OFFICER' then
  if p_position is null or p_position not in ('CLASS_PRESIDENT','CLASS_VICE_PRESIDENT') then raise exception 'POSITION_REQUIRED';end if;
  insert into public.class_officer_assignments(user_id,class_id,position) values(p_user,cls,p_position);
 end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(coalesce(p_issuer,p_user),'account.temporary_issued',p_user);
end $$;
revoke all on function app_private.initialize_provisioned_account(uuid,text,text,text,text,text,uuid) from public,anon,authenticated,service_role;
commit;
