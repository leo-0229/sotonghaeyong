begin;
-- Historical migrations are retained. This migration is the current pilot policy.
create or replace function public.store_moderated_post(p_user uuid,p_board text,p_title text,p_content text,p_status text,p_reasons text[],p_id uuid default null) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=coalesce(p_id,gen_random_uuid());lvl int;board public.boards;begin
 select r.level into lvl from public.profiles p join public.user_roles u on u.user_id=p.id join public.roles r on r.code=u.role_code where p.id=p_user and p.status='ACTIVE' and not p.credentials_pending;if lvl is null then raise exception 'ACTIVE_MEMBER_REQUIRED';end if;
 select * into board from public.boards where slug=p_board;if not found or (board.official and lvl<4) then raise exception 'BOARD_PERMISSION_DENIED';end if;
 -- Even the AI service cannot publish. Human approval uses review_post instead.
 if p_status is null or p_status not in ('DRAFT','PENDING') then raise exception 'HUMAN_APPROVAL_REQUIRED';end if;
 if p_id is not null then
  perform 1 from public.posts where id=p_id and author_id=p_user and status in ('DRAFT','REJECTED') for update;if not found then raise exception 'NOT_EDITABLE_POST';end if;
  insert into public.post_revisions(post_id,editor_id,title,content) select id,p_user,title,content from public.posts where id=p_id;
  update public.posts set board_id=board.id,title=p_title,content=p_content,status=p_status,moderation_reasons=p_reasons,moderation_source='HUMAN_REQUIRED' where id=p_id;
 else insert into public.posts(id,board_id,author_id,title,content,status,moderation_reasons,moderation_source) values(result,board.id,p_user,p_title,p_content,p_status,p_reasons,'HUMAN_REQUIRED');end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(p_user,'post.approval_requested',result);return result;
end $$;

-- One issued account per numeric level. Both L4 roles share a single slot.
-- Slots stay occupied when an account is suspended or withdrawn.
create table app_private.pilot_account_slots(level int primary key check(level between 1 and 5),user_id uuid not null unique references auth.users(id) on delete cascade);
revoke all on app_private.pilot_account_slots from public,anon,authenticated,service_role;
insert into app_private.pilot_account_slots(level,user_id)
select r.level,p.id from public.profiles p join public.user_roles u on u.user_id=p.id join public.roles r on r.code=u.role_code where p.login_id is not null;

alter function public.initialize_provisioned_account(uuid,text,text,text,text,text,uuid) set schema app_private;
revoke all on function app_private.initialize_provisioned_account(uuid,text,text,text,text,text,uuid) from public,anon,authenticated,service_role;
create function public.initialize_provisioned_account(p_user uuid,p_name text,p_student_id text,p_gender text,p_role text default 'STUDENT',p_position text default null,p_issuer uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_level int;begin
 perform pg_advisory_xact_lock(20261108,4);
 select level into target_level from public.roles where code=p_role;
 if target_level is null then raise exception 'INVALID_ROLE';end if;
 if exists(select 1 from app_private.pilot_account_slots where level=target_level) then raise exception 'PILOT_LEVEL_LIMIT';end if;
 perform app_private.initialize_provisioned_account(p_user,p_name,p_student_id,p_gender,p_role,p_position,p_issuer);
 insert into app_private.pilot_account_slots(level,user_id) values(target_level,p_user);
end $$;
revoke all on function public.initialize_provisioned_account(uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.initialize_provisioned_account(uuid,text,text,text,text,text,uuid) to service_role;

create function app_private.check_pilot_role() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_level int;begin
 perform pg_advisory_xact_lock(20261108,4);
 if exists(select 1 from app_private.pilot_account_slots where user_id=new.user_id) then
  select level into target_level from public.roles where code=new.role_code;
  if exists(select 1 from app_private.pilot_account_slots where level=target_level and user_id<>new.user_id) then raise exception 'PILOT_LEVEL_LIMIT';end if;
  update app_private.pilot_account_slots set level=target_level where user_id=new.user_id;
 end if;
 return new;
end $$;
revoke all on function app_private.check_pilot_role() from public,anon,authenticated,service_role;
create trigger check_pilot_role after update of role_code on public.user_roles for each row execute function app_private.check_pilot_role();
commit;
