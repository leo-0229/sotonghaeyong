begin;
create table app_private.account_maintenance(
 user_id uuid primary key references auth.users(id) on delete cascade,
 operation_id uuid not null unique default gen_random_uuid(),
 operation text not null check(operation in ('reissue','delete')),
 credential_version int not null,
 sealed_password text,
 actor_id uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
revoke all on app_private.account_maintenance from public,anon,authenticated,service_role;

create function public.begin_managed_account_action(p_actor uuid,p_target uuid,p_name text,p_operation text,p_login_id text default null,p_sealed text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare target public.profiles; target_role text; op_id uuid=gen_random_uuid(); next_version int;begin
 perform pg_advisory_xact_lock(20261108,8);
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_actor and p.status='ACTIVE' and not p.credentials_pending and r.role_code='SUPERVISING_TEACHER') then raise exception 'L5_REQUIRED';end if;
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

create function public.finish_account_reissue(p_actor uuid,p_target uuid,p_operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare job app_private.account_maintenance; profile public.profiles; auth_email text; metadata jsonb;begin
 perform pg_advisory_xact_lock(20261108,8);
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_actor and p.status='ACTIVE' and not p.credentials_pending and r.role_code='SUPERVISING_TEACHER') then raise exception 'L5_REQUIRED';end if;
 select * into job from app_private.account_maintenance where user_id=p_target and operation_id=p_operation_id and actor_id=p_actor and operation='reissue' for update;
 if not found then raise exception 'STALE_ACCOUNT_ACTION';end if;
 select * into profile from public.profiles where id=p_target for update;
 select email,raw_app_meta_data into auth_email,metadata from auth.users where id=p_target;
 if auth_email is distinct from profile.login_id||'@accounts.mpms.invalid' or metadata->>'maintenance_id' is distinct from p_operation_id::text or metadata->>'credential_version' is distinct from job.credential_version::text or profile.credential_version<>job.credential_version or not profile.credentials_pending then raise exception 'AUTH_UPDATE_NOT_CONFIRMED';end if;
 perform public.store_temporary_credential(p_target,job.sealed_password);
 delete from app_private.credential_progress where user_id=p_target;
 delete from app_private.account_maintenance where user_id=p_target;
 insert into public.audit_logs(actor_id,action,resource_id) values(p_actor,'account.reissued',p_target);
end $$;

create function public.account_action_pending(p_user uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from app_private.account_maintenance where user_id=p_user);
$$;

revoke all on function public.begin_managed_account_action(uuid,uuid,text,text,text,text),public.finish_account_reissue(uuid,uuid,uuid),public.account_action_pending(uuid) from public,anon,authenticated;
grant execute on function public.begin_managed_account_action(uuid,uuid,text,text,text,text),public.finish_account_reissue(uuid,uuid,uuid),public.account_action_pending(uuid) to service_role;
commit;
