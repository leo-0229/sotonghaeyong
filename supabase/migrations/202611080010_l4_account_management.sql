begin;
-- Account creation, member directory and deletion are shared by L4 and L5.
-- Temporary-password lookup, reissue and L5 issuance remain L5-only.
alter policy profile_read on public.profiles using(id=auth.uid() or (public.current_level()>0 and status='ACTIVE') or public.current_level()>=4);
alter policy user_role_read on public.user_roles using(user_id=auth.uid() or public.current_level()>=4);
create or replace function public.account_directory() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()<4 then raise exception 'ACCOUNT_MANAGER_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'loginId',login_id,'mustChangeCredentials',credentials_pending)) from public.profiles),'[]');
end $$;
create or replace function app_private.initialize_provisioned_account(p_user uuid,p_name text,p_student_id text,p_gender text,p_role text default 'STUDENT',p_position text default null,p_issuer uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare email_value text; username text; cls uuid; grade_value int; room_value int; begin
 if char_length(btrim(p_name)) not between 2 and 30 or p_name is null then raise exception 'INVALID_NAME';end if;
 if p_role not in ('STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER') or p_role is null then raise exception 'INVALID_ROLE';end if;
 if p_issuer is not null and (not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_issuer and p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER'))) then raise exception 'ACCOUNT_MANAGER_REQUIRED';end if;
 if p_issuer is not null and p_role='SUPERVISING_TEACHER' and not exists(select 1 from public.user_roles where user_id=p_issuer and role_code='SUPERVISING_TEACHER') then raise exception 'L5_REQUIRED';end if;
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
create or replace function public.begin_managed_account_action(p_actor uuid,p_target uuid,p_name text,p_operation text,p_login_id text default null,p_sealed text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare target public.profiles; target_role text; op_id uuid=gen_random_uuid(); next_version int;begin
 perform pg_advisory_xact_lock(20261108,8);
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_actor and p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER')) then raise exception 'ACCOUNT_MANAGER_REQUIRED';end if;
 if p_operation='reissue' and not exists(select 1 from public.user_roles where user_id=p_actor and role_code='SUPERVISING_TEACHER') then raise exception 'L5_REQUIRED';end if;
 if p_actor=p_target then raise exception 'SELF_ACCOUNT_ACTION_DENIED';end if;
 if p_operation is null or p_operation not in ('reissue','delete') then raise exception 'INVALID_OPERATION';end if;
 select * into target from public.profiles where id=p_target for update;
 if not found then raise exception 'ACCOUNT_NOT_FOUND';end if;
 if p_name is null or p_name<>target.display_name then raise exception 'CONFIRM_NAME_REQUIRED';end if;
 select role_code into target_role from public.user_roles where user_id=p_target;
 if target_role='SUPERVISING_TEACHER' and not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id<>p_target and p.status='ACTIVE' and not p.credentials_pending and r.role_code='SUPERVISING_TEACHER') then raise exception 'LAST_L5_REQUIRED';end if;
 if p_operation='reissue' and target.status<>'ACTIVE' then raise exception 'ACTIVE_ACCOUNT_REQUIRED';end if;
 if p_operation='reissue' and (p_login_id is null or p_login_id!~'^tmp_[a-z0-9_]{4,20}$' or p_sealed is null or octet_length(p_sealed) not between 20 and 8192) then raise exception 'INVALID_TEMPORARY_CREDENTIAL';end if;
 next_version=target.credential_version+1;
 -- Revoke old refresh sessions and JWT access before any remote Auth update.
 delete from auth.refresh_tokens where user_id::text=p_target::text;
 delete from auth.sessions where user_id=p_target;
 delete from app_private.credential_progress where user_id=p_target;
 delete from app_private.temporary_account_credentials where user_id=p_target;
 update public.profiles set credentials_pending=true,credential_version=next_version,
  login_id=case when p_operation='reissue' then p_login_id else login_id end,
  status=case when p_operation='delete' then 'SUSPENDED' else status end where id=p_target;
 insert into app_private.account_maintenance(user_id,operation_id,operation,credential_version,sealed_password,actor_id)
 values(p_target,op_id,p_operation,next_version,p_sealed,p_actor)
 on conflict(user_id) do update set operation_id=excluded.operation_id,operation=excluded.operation,credential_version=excluded.credential_version,sealed_password=excluded.sealed_password,actor_id=excluded.actor_id,created_at=now();
 insert into public.audit_logs(actor_id,action,resource_id) values(p_actor,'account.'||p_operation||'_requested',p_target);
 return jsonb_build_object('operationId',op_id,'credentialVersion',next_version);
end $$;


commit;

