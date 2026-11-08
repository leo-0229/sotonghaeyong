begin;
alter table public.profiles add column student_id text;
alter table public.profiles add column login_id text unique check(login_id is null or login_id~'^[a-z][a-z0-9_]{3,23}$');
alter table public.profiles add column credentials_pending boolean not null default false;
alter table public.profiles add column credential_version int not null default 0 check(credential_version>=0);
alter table public.profiles add column credentials_changed_at timestamptz;
create unique index profiles_student_unique on public.profiles(class_id,student_id) where student_id is not null;
-- Student IDs and login IDs are deliberately excluded from the existing public column grants.
create schema if not exists app_private;
revoke all on schema app_private from public,anon,authenticated;
create table app_private.credential_progress(user_id uuid primary key references auth.users(id) on delete cascade,username_changed boolean not null default false,password_changed boolean not null default false);
revoke all on app_private.credential_progress from public,anon,authenticated;

create or replace function public.current_level() returns int language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select r.level::int from public.profiles p join public.user_roles u on u.user_id=p.id join public.roles r on r.code=u.role_code
 where p.id=auth.uid() and p.status='ACTIVE' and not p.credentials_pending and
 (p.login_id is null or (coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->'app_metadata'->>'credential_version')=p.credential_version::text)),0);
$$;
alter policy classes_read on public.school_classes using(public.current_level()>0);
alter policy roles_read on public.roles using(public.current_level()>0);

create function public.sync_auth_credentials() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare profile public.profiles; progress app_private.credential_progress; candidate text; new_version int; begin
 select * into profile from public.profiles where id=new.id for update;
 if not found or profile.login_id is null then return new;end if;
 insert into app_private.credential_progress(user_id,username_changed,password_changed)
 values(new.id,new.email is distinct from old.email,new.encrypted_password is distinct from old.encrypted_password)
 on conflict(user_id) do update set username_changed=app_private.credential_progress.username_changed or excluded.username_changed,password_changed=app_private.credential_progress.password_changed or excluded.password_changed;
 select * into progress from app_private.credential_progress where user_id=new.id;
 candidate=split_part(lower(new.email),'@',1);
 if coalesce(new.raw_app_meta_data->>'credential_version','')~'^[0-9]{1,9}$' then new_version=(new.raw_app_meta_data->>'credential_version')::int;end if;
 if progress.username_changed and progress.password_changed and new.email=candidate||'@accounts.mpms.invalid' and candidate~'^[a-z][a-z0-9_]{3,23}$' and left(candidate,4)<>'tmp_' and new_version=profile.credential_version+1 then
  update public.profiles set login_id=candidate,credentials_pending=false,credential_version=new_version,credentials_changed_at=now() where id=new.id;
  delete from app_private.credential_progress where user_id=new.id;
  insert into public.audit_logs(actor_id,action,resource_id) values(new.id,'account.credentials_changed',new.id);
 end if;
 return new;
end $$;
create trigger sync_auth_credentials after update of email,encrypted_password,raw_app_meta_data on auth.users for each row execute function public.sync_auth_credentials();

create function public.own_account() returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('id',id,'name',display_name,'studentId',student_id,'gender',gender,'classId',public.class_label(class_id),'loginId',login_id,'mustChangeCredentials',credentials_pending,'credentialVersion',credential_version,'status',status)
 from public.profiles where id=auth.uid();
$$;
create function public.account_directory() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()<>5 then raise exception 'TEACHER_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'loginId',login_id,'mustChangeCredentials',credentials_pending)) from public.profiles),'[]');
end $$;

create function public.initialize_provisioned_account(p_user uuid,p_name text,p_student_id text,p_gender text,p_role text default 'STUDENT',p_position text default null,p_issuer uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare email_value text; username text; cls uuid; grade_value int; room_value int; begin
 if char_length(btrim(p_name)) not between 2 and 30 or p_name is null then raise exception 'INVALID_NAME';end if;
 if p_role not in ('STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER') or p_role is null then raise exception 'INVALID_ROLE';end if;
 if p_issuer is not null and (p_role='SUPERVISING_TEACHER' or not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_issuer and p.status='ACTIVE' and not p.credentials_pending and r.role_code='SUPERVISING_TEACHER')) then raise exception 'TEACHER_REQUIRED';end if;
 select email into email_value from auth.users where id=p_user;
 username=split_part(email_value,'@',1);
 if email_value is null or email_value<>username||'@accounts.mpms.invalid' or username!~'^tmp_[a-z0-9_]{4,20}$' then raise exception 'TEMPORARY_AUTH_USER_REQUIRED';end if;
 if p_role<>'SUPERVISING_TEACHER' then
  if p_student_id is null or p_student_id!~'^[1-3]0[1-6](0[1-9]|[1-9][0-9])$' or p_gender is null or p_gender not in ('MALE','FEMALE') then raise exception 'VERIFIED_STUDENT_ID_AND_GENDER_REQUIRED';end if;
  grade_value=left(p_student_id,1)::int;room_value=substring(p_student_id from 3 for 1)::int;
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

create table app_private.account_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,operation text not null,created_at timestamptz not null default now());
create index account_requests_rate on app_private.account_requests(user_id,created_at);
create function public.reserve_account_request(p_user uuid,p_operation text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_operation not in ('issue','change') then raise exception 'INVALID_OPERATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,3));
 if (select count(*) from app_private.account_requests where user_id=p_user and operation=p_operation and created_at>now()-interval '15 minutes') >= (case when p_operation='change' then 10 else 60 end) then raise exception 'RATE_LIMITED';end if;
 delete from app_private.account_requests where user_id=p_user and created_at<now()-interval '1 day';
 insert into app_private.account_requests(user_id,operation) values(p_user,p_operation);
end $$;
revoke all on function public.sync_auth_credentials(),public.own_account(),public.account_directory(),public.initialize_provisioned_account(uuid,text,text,text,text,text,uuid),public.reserve_account_request(uuid,text) from public,anon,authenticated;
grant execute on function public.own_account(),public.account_directory() to authenticated;
grant execute on function public.initialize_provisioned_account(uuid,text,text,text,text,text,uuid),public.reserve_account_request(uuid,text) to service_role;
commit;
