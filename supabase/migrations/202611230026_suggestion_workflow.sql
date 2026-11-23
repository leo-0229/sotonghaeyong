begin;

-- Additive, scoped workflow storage. No account/content rows are rewritten.
create table app_private.suggestion_handling (
 suggestion_id uuid primary key references public.suggestions(id) on delete cascade,
 handler_id uuid references public.profiles(id) on delete set null,
 due_on date
);
create table app_private.suggestion_transitions (
 id bigint generated always as identity primary key,
 suggestion_id uuid not null references public.suggestions(id) on delete cascade,
 previous_status text,
 status text not null,
 actor_id uuid references public.profiles(id) on delete set null,
 note text check(char_length(note)<=1000),
 created_at timestamptz not null default clock_timestamp()
);
create index suggestion_transition_lookup on app_private.suggestion_transitions(suggestion_id,id desc);
revoke all on app_private.suggestion_handling,app_private.suggestion_transitions from public,anon,authenticated,service_role;

create function app_private.track_suggestion_transition() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='INSERT' then
  insert into app_private.suggestion_transitions(suggestion_id,status,actor_id) values(new.id,new.status,auth.uid());
 elsif new.status is distinct from old.status then
  insert into app_private.suggestion_transitions(suggestion_id,previous_status,status,actor_id) values(new.id,old.status,new.status,auth.uid());
 end if;
 return new;
end $$;
revoke all on function app_private.track_suggestion_transition() from public,anon,authenticated,service_role;
create trigger track_suggestion_transition after insert or update of status on public.suggestions
for each row execute function app_private.track_suggestion_transition();

create function public.suggestion_workflow(p_suggestion uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare item public.suggestions; can_inspect boolean;
begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if not coalesce(public.reads_suggestion(p_suggestion),false) then return null;end if;
 select * into item from public.suggestions where id=p_suggestion;
 if not found then return null;end if;
 can_inspect=item.author_id=auth.uid() or public.is_council_member() or public.current_level()=5;
 -- Public question readers can see its status, but not internal handling details.
 if not can_inspect then return jsonb_build_object('status',item.status,'version',null,'history','[]'::jsonb);end if;
 return jsonb_build_object('status',item.status,'version',item.updated_at,
  'handlerId',(select handler_id from app_private.suggestion_handling where suggestion_id=item.id),
  'handler',(select p.display_name from app_private.suggestion_handling h join public.profiles p on p.id=h.handler_id where h.suggestion_id=item.id),
  'dueOn',(select due_on from app_private.suggestion_handling where suggestion_id=item.id),
  'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'status',h.status,'actor',coalesce(p.display_name,'자동 처리 또는 탈퇴 운영진'),'note',h.note,'date',h.created_at) order by h.id desc)
   from (select * from app_private.suggestion_transitions where suggestion_id=item.id order by id desc limit 30) h
   left join public.profiles p on p.id=h.actor_id),'[]'::jsonb));
end $$;

create function public.update_suggestion_workflow(p_suggestion uuid,p_status text,p_note text,p_handler uuid,p_due_on date,p_expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.suggestions; transition_id bigint;
begin
 if not coalesce(public.is_council_member(),false) then raise exception 'COUNCIL_REQUIRED';end if;
 if p_status is null or p_status not in ('RECEIVED','REVIEWING','ASSIGNED','RESOLVED','REJECTED') then raise exception 'INVALID_STATUS';end if;
 if char_length(btrim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'HANDLING_NOTE_REQUIRED';end if;
 select * into item from public.suggestions where id=p_suggestion for update;
 if not found then raise exception 'SUGGESTION_NOT_FOUND';end if;
 if p_expected_updated_at is null or item.updated_at<>p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
 if p_handler is not null and not exists(
  select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
  where p.id=p_handler and p.status='ACTIVE' and not p.credentials_pending
   and r.role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR')
 ) then raise exception 'ACTIVE_COUNCIL_HANDLER_REQUIRED';end if;
 insert into app_private.suggestion_handling(suggestion_id,handler_id,due_on) values(item.id,p_handler,p_due_on)
 on conflict(suggestion_id) do update set handler_id=excluded.handler_id,due_on=excluded.due_on;
 update public.suggestions set status=p_status where id=item.id;
 if p_status=item.status then
  insert into app_private.suggestion_transitions(suggestion_id,previous_status,status,actor_id,note)
  values(item.id,item.status,p_status,auth.uid(),btrim(p_note));
 else
  select id into transition_id from app_private.suggestion_transitions where suggestion_id=item.id order by id desc limit 1;
  update app_private.suggestion_transitions set note=btrim(p_note) where id=transition_id;
 end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(auth.uid(),'suggestion.workflow.'||lower(p_status),item.id);
 insert into public.notifications(recipient_id,title,href) values(item.author_id,'건의 처리 상태가 변경되었습니다. 사유와 진행 상황을 확인해 주세요.','/suggestions/mine?id='||item.id);
 return public.suggestion_workflow(item.id);
end $$;

revoke all on function public.suggestion_workflow(uuid),public.update_suggestion_workflow(uuid,text,text,uuid,date,timestamptz) from public,anon,authenticated;
grant execute on function public.suggestion_workflow(uuid),public.update_suggestion_workflow(uuid,text,text,uuid,date,timestamptz) to authenticated;

create table app_private.pledge_changes (
 id bigint generated always as identity primary key,
 pledge_id uuid not null references public.pledges(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index pledge_change_lookup on app_private.pledge_changes(pledge_id,id desc);
revoke all on app_private.pledge_changes from public,anon,authenticated,service_role;
create function app_private.track_pledge_change() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='UPDATE' then
  if (new.title,new.description,new.department,new.progress,new.status,new.details) is not distinct from
   (old.title,old.description,old.department,old.progress,old.status,old.details) then return new;end if;
 end if;
 insert into app_private.pledge_changes(pledge_id,actor_id,snapshot) values(new.id,auth.uid(),
  jsonb_build_object('title',new.title,'description',new.description,'department',new.department,'progress',new.progress,'status',new.status,'details',new.details));
 return new;
end $$;
revoke all on function app_private.track_pledge_change() from public,anon,authenticated,service_role;
create trigger track_pledge_change after insert or update on public.pledges for each row execute function app_private.track_pledge_change();
create function public.pledge_history(p_pledge uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'date',h.created_at,'actor',coalesce(p.display_name,'탈퇴 운영진 또는 초기 등록'),'change',h.snapshot) order by h.id desc)
  from (select * from app_private.pledge_changes where pledge_id=p_pledge order by id desc limit 20) h
  left join public.profiles p on p.id=h.actor_id),'[]'::jsonb);
end $$;
revoke all on function public.pledge_history(uuid) from public,anon,authenticated;
grant execute on function public.pledge_history(uuid) to authenticated;
commit;
