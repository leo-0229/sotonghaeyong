begin;

-- Automatic publication now attests a clean server-side rule check, not an AI decision.
-- Storage RPCs remain service-role only; clients cannot assert this flag.

drop function public.store_moderated_post(uuid,text,text,text,text,text[],uuid,text,boolean);
create function public.store_moderated_post(p_user uuid,p_board text,p_title text,p_content text,p_status text,p_reasons text[],p_id uuid default null,p_prefix text default '',p_rules_verified boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=coalesce(p_id,gen_random_uuid());lvl int;board public.boards;begin
 select r.level into lvl from public.profiles p join public.user_roles u on u.user_id=p.id join public.roles r on r.code=u.role_code where p.id=p_user and p.status='ACTIVE' and not p.credentials_pending;if lvl is null then raise exception 'ACTIVE_MEMBER_REQUIRED';end if;
 select * into board from public.boards where slug=p_board;if not found or (board.official and lvl<4) then raise exception 'BOARD_PERMISSION_DENIED';end if;
 if p_status is null or p_status not in ('DRAFT','PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_rules_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'RULE_OR_HUMAN_APPROVAL_REQUIRED';end if;
 if p_prefix is null or char_length(btrim(p_prefix))>20 or p_prefix~'[[:cntrl:]]' then raise exception 'INVALID_PREFIX';end if;
 if p_id is not null then
  perform 1 from public.posts where id=p_id and author_id=p_user and status in ('DRAFT','REJECTED','PENDING','APPROVED') for update;
  if not found then raise exception 'NOT_EDITABLE_POST';end if;
  insert into public.post_revisions(post_id,editor_id,title,content,prefix,board_id,previous_status)
   select id,p_user,title,content,prefix,board_id,status from public.posts where id=p_id;
  update public.posts set board_id=board.id,title=p_title,content=p_content,prefix=btrim(p_prefix),status=p_status,moderation_reasons=p_reasons,moderation_source=case when p_status='APPROVED' then 'RULE_APPROVED' else 'REVIEW_REQUIRED' end where id=p_id;
 else
  insert into public.posts(id,board_id,author_id,title,content,prefix,status,moderation_reasons,moderation_source)
   values(result,board.id,p_user,p_title,p_content,btrim(p_prefix),p_status,p_reasons,case when p_status='APPROVED' then 'RULE_APPROVED' else 'REVIEW_REQUIRED' end);
 end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(p_user,case when p_status='APPROVED' then 'post.rule_approved' when p_status='DRAFT' then 'post.draft_saved' when p_id is null then 'post.approval_requested' else 'post.edited_reapproval_required' end,result);
 return result;
end $$;
revoke all on function public.store_moderated_post(uuid,text,text,text,text,text[],uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.store_moderated_post(uuid,text,text,text,text,text[],uuid,text,boolean) to service_role;

drop function public.store_moderated_comment(uuid,uuid,text,uuid,text,text[],boolean);
create function public.store_moderated_comment(p_user uuid,p_post uuid,p_content text,p_parent uuid,p_status text,p_reasons text[],p_rules_verified boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=gen_random_uuid();begin
 if not exists(select 1 from public.profiles where id=p_user and status='ACTIVE' and not credentials_pending) then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if not exists(select 1 from public.posts where id=p_post and status='APPROVED') then raise exception 'PUBLIC_POST_REQUIRED';end if;
 if p_parent is not null and not exists(select 1 from public.comments where id=p_parent and post_id=p_post and parent_id is null and status='APPROVED') then raise exception 'INVALID_REPLY_TARGET';end if;
 if p_status is null or p_status not in ('PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_rules_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'RULE_OR_HUMAN_APPROVAL_REQUIRED';end if;
 insert into public.comments(id,post_id,author_id,content,parent_id,status,moderation_reasons) values(result,p_post,p_user,btrim(p_content),p_parent,p_status,p_reasons);
 insert into public.notifications(recipient_id,title,href) select author_id,'내 글에 댓글이 등록되었습니다.','/posts/'||p_post from public.posts where id=p_post and author_id is not null and author_id<>p_user and p_status='APPROVED';
 return result;
end $$;
revoke all on function public.store_moderated_comment(uuid,uuid,text,uuid,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.store_moderated_comment(uuid,uuid,text,uuid,text,text[],boolean) to service_role;

drop function public.store_moderated_suggestion(uuid,text,text,text,text,text,text[],boolean);
create function public.store_moderated_suggestion(p_user uuid,p_title text,p_category text,p_content text,p_visibility text,p_status text,p_reasons text[],p_rules_verified boolean default false) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=gen_random_uuid();begin
 if not exists(select 1 from public.profiles where id=p_user and status='ACTIVE' and not credentials_pending) then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if p_visibility is null or p_visibility not in ('PUBLIC','PRIVATE') then raise exception 'INVALID_VISIBILITY';end if;
 if p_status is null or p_status not in ('PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_rules_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'RULE_OR_HUMAN_APPROVAL_REQUIRED';end if;
 insert into public.suggestions(id,author_id,title,category,content,visibility,publication_status,moderation_reasons) values(result,p_user,p_title,p_category,p_content,p_visibility,p_status,p_reasons);
 perform app_private.channel_notice(p_user,case when p_visibility='PUBLIC' then '공개' else '비공개' end||' 건의 ['||left(p_title,100)||']가 접수되었습니다. 학생회가 확인 후 답변합니다.');
 return result;
end $$;
revoke all on function public.store_moderated_suggestion(uuid,text,text,text,text,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.store_moderated_suggestion(uuid,text,text,text,text,text,text[],boolean) to service_role;

drop function public.store_moderated_suggestion_reply(uuid,uuid,text,text,text[],boolean);
create function public.store_moderated_suggestion_reply(p_user uuid,p_suggestion uuid,p_content text,p_status text,p_reasons text[],p_rules_verified boolean default false) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=gen_random_uuid();owner_id uuid;begin
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_user and p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR')) then raise exception 'COUNCIL_REPLY_REQUIRED';end if;
 select author_id into owner_id from public.suggestions where id=p_suggestion;if not found then raise exception 'SUGGESTION_NOT_FOUND';end if;
 if p_status is null or p_status not in ('PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_rules_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'RULE_OR_HUMAN_APPROVAL_REQUIRED';end if;
 insert into public.suggestion_replies(id,suggestion_id,author_id,content,publication_status,moderation_reasons) values(result,p_suggestion,p_user,p_content,p_status,p_reasons);
 if p_status='APPROVED' then update public.suggestions set status='RESOLVED' where id=p_suggestion;insert into public.notifications(recipient_id,title,href) values(owner_id,'학생회가 건의에 답변했습니다.','/suggestions');end if;
 return result;
end $$;
revoke all on function public.store_moderated_suggestion_reply(uuid,uuid,text,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.store_moderated_suggestion_reply(uuid,uuid,text,text,text[],boolean) to service_role;

commit;
