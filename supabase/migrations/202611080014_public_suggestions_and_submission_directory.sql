begin;
alter table public.suggestions add column visibility text not null default 'PRIVATE' check(visibility in ('PUBLIC','PRIVATE'));
alter table public.suggestions add column publication_status text not null default 'PENDING' check(publication_status in ('PENDING','APPROVED','REJECTED'));
alter table public.suggestions add column moderation_reasons text[] not null default '{}';
alter table public.suggestion_replies add column publication_status text not null default 'APPROVED' check(publication_status in ('PENDING','APPROVED','REJECTED'));
alter table public.suggestion_replies add column moderation_reasons text[] not null default '{}';
revoke insert(author_id,title,category,content) on public.suggestions from authenticated;
create or replace function public.reads_suggestion(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.current_level()>0 and exists(select 1 from public.suggestions where id=p_id and (author_id=auth.uid() or (visibility='PUBLIC' and publication_status='APPROVED') or public.is_council_member() or public.current_level()=5));
$$;
alter policy replies_read on public.suggestion_replies using(public.reads_suggestion(suggestion_id) and (publication_status='APPROVED' or author_id=auth.uid() or public.current_level()>=3));
create function public.store_moderated_suggestion(p_user uuid,p_title text,p_category text,p_content text,p_visibility text,p_status text,p_reasons text[],p_ai_verified boolean default false) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=gen_random_uuid();begin
 if not exists(select 1 from public.profiles where id=p_user and status='ACTIVE' and not credentials_pending) then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if p_visibility is null or p_visibility not in ('PUBLIC','PRIVATE') then raise exception 'INVALID_VISIBILITY';end if;
 if p_status is null or p_status not in ('PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_ai_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'AI_OR_HUMAN_APPROVAL_REQUIRED';end if;
 insert into public.suggestions(id,author_id,title,category,content,visibility,publication_status,moderation_reasons) values(result,p_user,p_title,p_category,p_content,p_visibility,p_status,p_reasons);
 perform app_private.channel_notice(p_user,case when p_visibility='PUBLIC' then '공개' else '비공개' end||' 건의 ['||left(p_title,100)||']가 접수되었습니다. 학생회가 확인 후 답변합니다.');
 return result;
end $$;
create function public.store_moderated_suggestion_reply(p_user uuid,p_suggestion uuid,p_content text,p_status text,p_reasons text[],p_ai_verified boolean default false) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=gen_random_uuid();owner_id uuid;begin
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_user and p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR')) then raise exception 'COUNCIL_REPLY_REQUIRED';end if;
 select author_id into owner_id from public.suggestions where id=p_suggestion;if not found then raise exception 'SUGGESTION_NOT_FOUND';end if;
 if p_status is null or p_status not in ('PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_ai_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'AI_OR_HUMAN_APPROVAL_REQUIRED';end if;
 insert into public.suggestion_replies(id,suggestion_id,author_id,content,publication_status,moderation_reasons) values(result,p_suggestion,p_user,p_content,p_status,p_reasons);
 if p_status='APPROVED' then update public.suggestions set status='RESOLVED' where id=p_suggestion;insert into public.notifications(recipient_id,title,href) values(owner_id,'학생회가 건의에 답변했습니다.','/suggestions');end if;
 return result;
end $$;
create function public.pending_suggestion_reviews() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()<3 then raise exception 'REVIEWER_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('kind','suggestion','id',s.id,'title',s.title,'content',s.content,'authorId',s.author_id,'author',p.display_name,'visibility',s.visibility,'reasons',s.moderation_reasons,'date',s.created_at)) from public.suggestions s join public.profiles p on p.id=s.author_id where s.publication_status='PENDING' and s.visibility='PUBLIC'),'[]')
 ||coalesce((select jsonb_agg(jsonb_build_object('kind','suggestion-reply','id',r.id,'title',s.title||' · 답변','content',r.content,'authorId',r.author_id,'author',p.display_name,'visibility',s.visibility,'reasons',r.moderation_reasons,'date',r.created_at)) from public.suggestion_replies r join public.suggestions s on s.id=r.suggestion_id left join public.profiles p on p.id=r.author_id where r.publication_status='PENDING'),'[]');
end $$;
create function public.review_suggestion_content(p_kind text,p_id uuid,p_decision text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare author uuid;suggestion uuid;begin
 if public.current_level()<3 then raise exception 'REVIEWER_REQUIRED';end if;
 if p_decision is null or p_decision not in ('APPROVED','REJECTED') then raise exception 'INVALID_DECISION';end if;
 if p_kind='suggestion' then
  select author_id into author from public.suggestions where id=p_id and publication_status='PENDING' for update;
  if not found or author=auth.uid() then raise exception 'OTHER_REVIEWER_REQUIRED';end if;
  update public.suggestions set publication_status=p_decision where id=p_id;
 elsif p_kind='suggestion-reply' then
  select author_id,suggestion_id into author,suggestion from public.suggestion_replies where id=p_id and publication_status='PENDING' for update;
  if not found or author=auth.uid() then raise exception 'OTHER_REVIEWER_REQUIRED';end if;
  update public.suggestion_replies set publication_status=p_decision where id=p_id;
  if p_decision='APPROVED' then update public.suggestions set status='RESOLVED' where id=suggestion;end if;
 else raise exception 'INVALID_CONTENT_KIND';end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(auth.uid(),p_kind||'.'||p_decision,p_id);
end $$;
revoke all on function public.store_moderated_suggestion(uuid,text,text,text,text,text,text[],boolean),public.store_moderated_suggestion_reply(uuid,uuid,text,text,text[],boolean),public.pending_suggestion_reviews(),public.review_suggestion_content(text,uuid,text) from public,anon,authenticated;
grant execute on function public.store_moderated_suggestion(uuid,text,text,text,text,text,text[],boolean),public.store_moderated_suggestion_reply(uuid,uuid,text,text,text[],boolean) to service_role;
grant execute on function public.pending_suggestion_reviews(),public.review_suggestion_content(text,uuid,text) to authenticated;

alter policy tasks_read on public.class_tasks using(public.current_level()>0);
alter policy task_targets_read on public.class_task_targets using(public.current_level()>0);
create function public.class_submission_count(p_task uuid) returns int language sql stable security definer set search_path=pg_catalog,public as $$
 select case when public.current_level()>0 then (select count(*)::int from public.class_task_submissions s where s.task_id=p_task and s.status<>'DRAFT' and exists(select 1 from public.class_task_targets t where t.task_id=s.task_id and t.class_id=s.class_id)) else 0 end;
$$;
revoke all on function public.class_submission_count(uuid) from public,anon;
grant execute on function public.class_submission_count(uuid) to authenticated;
create function public.class_submission_directory(p_task uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('classId',public.class_label(t.class_id),'status',case when s.status='DRAFT' then 'NOT_SUBMITTED' else coalesce(s.status,'NOT_SUBMITTED') end,'submittedBy',case when s.status<>'DRAFT' then coalesce(a.display_name,'탈퇴 회원') else null end,'updatedBy',case when s.status<>'DRAFT' then coalesce(b.display_name,'탈퇴 회원') else null end,'updatedAt',case when s.status<>'DRAFT' then s.updated_at else null end) order by c.grade,c.room) from public.class_task_targets t join public.school_classes c on c.id=t.class_id left join public.class_task_submissions s on s.task_id=t.task_id and s.class_id=t.class_id left join public.profiles a on a.id=s.submitted_by left join public.profiles b on b.id=s.updated_by where t.task_id=p_task),'[]');
end $$;
revoke all on function public.class_submission_directory(uuid) from public,anon;
grant execute on function public.class_submission_directory(uuid) to authenticated;
commit;
