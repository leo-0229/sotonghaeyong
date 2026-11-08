begin;

alter table public.comments add column updated_at timestamptz;
alter table public.suggestion_replies add column updated_at timestamptz;

-- now() is fixed for a transaction; edits need a strictly advancing version.
create function app_private.touch_suggestion_edit_time() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin new.updated_at=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');return new;end $$;
revoke all on function app_private.touch_suggestion_edit_time() from public,anon,authenticated,service_role;
drop trigger touch_updated_at on public.suggestions;
create trigger touch_updated_at before update on public.suggestions for each row execute function app_private.touch_suggestion_edit_time();

-- Serialize reply creation against privacy changes on its question.
create function app_private.lock_reply_question() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform 1 from public.suggestions where id=new.suggestion_id for update;
 return new;
end $$;
revoke all on function app_private.lock_reply_question() from public,anon,authenticated,service_role;
create trigger lock_reply_question before insert on public.suggestion_replies
for each row execute function app_private.lock_reply_question();

-- Only the moderation service may submit its freshly checked replacement.
create function public.edit_moderated_content(
 p_kind text,p_user uuid,p_id uuid,p_content text,p_status text,p_reasons text[],
 p_rules_verified boolean,p_expected_updated_at timestamptz,
 p_title text default null,p_category text default null,p_visibility text default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare question public.suggestions; answer public.suggestion_replies; comment public.comments; question_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_user and status='ACTIVE' and not credentials_pending) then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if p_status is null or p_status not in ('PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_rules_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'RULE_OR_HUMAN_APPROVAL_REQUIRED';end if;
 if p_expected_updated_at is null then raise exception 'EDIT_VERSION_REQUIRED';end if;
 if p_kind='suggestion' then
  select * into question from public.suggestions where id=p_id and author_id=p_user for update;
  if not found then raise exception 'OWN_CONTENT_REQUIRED';end if;
  if question.updated_at<>p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
  if p_visibility is null or p_visibility not in ('PRIVATE','PUBLIC') then raise exception 'INVALID_VISIBILITY';end if;
  if question.visibility='PRIVATE' and p_visibility='PUBLIC' and exists(select 1 from public.suggestion_replies where suggestion_id=p_id) then raise exception 'PRIVATE_REPLIES_PROTECTED';end if;
  if p_title is null or p_category is null or p_content is null then raise exception 'INVALID_CONTENT';end if;
  update public.suggestions set title=btrim(p_title),category=p_category,content=btrim(p_content),visibility=p_visibility,publication_status=p_status,moderation_reasons=p_reasons,updated_at=clock_timestamp() where id=p_id;
 elsif p_kind='comment' then
  select * into comment from public.comments where id=p_id and author_id=p_user for update;
  if not found then raise exception 'OWN_CONTENT_REQUIRED';end if;
  if comment.status not in ('PENDING','APPROVED','REJECTED') then raise exception 'CONTENT_NOT_EDITABLE';end if;
  if coalesce(comment.updated_at,comment.created_at)<>p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
  if not exists(select 1 from public.posts where id=comment.post_id and status='APPROVED') then raise exception 'PUBLIC_POST_REQUIRED';end if;
  update public.comments set content=btrim(p_content),status=p_status,moderation_reasons=p_reasons,updated_at=clock_timestamp() where id=p_id;
 elsif p_kind='suggestion-reply' then
  if not exists(select 1 from public.user_roles where user_id=p_user and role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR')) then raise exception 'COUNCIL_REPLY_REQUIRED';end if;
  select suggestion_id into question_id from public.suggestion_replies where id=p_id and author_id=p_user;
  if not found then raise exception 'OWN_CONTENT_REQUIRED';end if;
  perform 1 from public.suggestions where id=question_id for update;
  select * into answer from public.suggestion_replies where id=p_id and author_id=p_user for update;
  if not found then raise exception 'OWN_CONTENT_REQUIRED';end if;
  if coalesce(answer.updated_at,answer.created_at)<>p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
  if p_content is null or char_length(btrim(p_content)) not between 5 and 3000 then raise exception 'INVALID_CONTENT';end if;
  update public.suggestion_replies set content=btrim(p_content),publication_status=p_status,moderation_reasons=p_reasons,updated_at=clock_timestamp() where id=p_id;
  if p_status='APPROVED' then update public.suggestions set status='RESOLVED' where id=question_id;
  elsif not exists(select 1 from public.suggestion_replies where suggestion_id=question_id and publication_status='APPROVED') then
   update public.suggestions set status='REVIEWING' where id=question_id and status='RESOLVED';
  end if;
 else raise exception 'INVALID_CONTENT_KIND';end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(p_user,p_kind||'.edited_rechecked',p_id);
 return p_id;
end $$;
revoke all on function public.edit_moderated_content(text,uuid,uuid,text,text,text[],boolean,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.edit_moderated_content(text,uuid,uuid,text,text,text[],boolean,timestamptz,text,text,text) to service_role;

create or replace function public.community_snapshot() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 result=jsonb_build_object('currentMemberId',auth.uid(),'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'classId',coalesce(public.class_label(p.class_id),''),'status',p.status,'gender',public.profile_gender(p.id),'role',coalesce((select role_code from public.user_roles where user_id=p.id),'STUDENT'),'position',(select position from public.class_officer_assignments where user_id=p.id and active))) from public.profiles p),'[]'),
 'posts','[]'::jsonb,'tasks','[]'::jsonb,'submissions','[]'::jsonb,'events','[]'::jsonb,'suggestions','[]'::jsonb,'pledges','[]'::jsonb,'surveys','[]'::jsonb,'mentoring','[]'::jsonb,'notifications','[]'::jsonb,'logs','[]'::jsonb,'reports','[]'::jsonb);
 if public.current_level()=0 then return result; end if;
 result=result||jsonb_build_object(
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'board',b.slug,'title',p.title,'prefix',p.prefix,'updatedAt',p.updated_at,'content',p.content,'authorId',p.author_id,'author',coalesce(a.display_name,'탈퇴 회원'),'date',p.created_at,'views',p.views,'hearts',public.heart_summary('post',p.id),'status',p.status,'pinned',p.pinned,'moderationReasons',p.moderation_reasons,'reason',case when p.status='REJECTED' then (select reason from public.post_reviews where post_id=p.id order by created_at desc limit 1) else null end,'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'authorId',c.author_id,'author',coalesce(cp.display_name,'탈퇴 회원'),'content',c.content,'date',c.created_at,'updatedAt',c.updated_at,'parentId',c.parent_id,'hearts',public.heart_summary('comment',c.id),'moderationReasons',c.moderation_reasons,'status',c.status)) from public.comments c left join public.profiles cp on cp.id=c.author_id where c.post_id=p.id),'[]'))) from public.posts p join public.boards b on b.id=p.board_id left join public.profiles a on a.id=p.author_id),'[]'),
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'department',t.department,'type',case t.task_type when 'EVENT' then '행사 참가' when 'OPINION' then '의견 제출' when 'DOCUMENT' then '자료 제출' when 'SURVEY' then '대표 설문' else '일반 업무' end,'start',t.starts_at,'deadline',t.deadline,'allowLate',t.allow_late,'closed',t.closed,'managerIds',coalesce((select jsonb_agg(user_id) from public.class_task_managers where task_id=t.id),'[]'),'submittedCount',public.class_submission_count(t.id),'targets',coalesce((select jsonb_agg(public.class_label(class_id)) from public.class_task_targets where task_id=t.id),'[]'),'fields',coalesce((select jsonb_agg(jsonb_build_object('id',field_key,'label',label,'type',field_type,'required',required,'options',options) order by sort_order) from public.class_task_form_fields where task_id=t.id),'[]'))) from public.class_tasks t),'[]'),
 'submissions',coalesce((select jsonb_agg(jsonb_build_object('taskId',s.task_id,'classId',public.class_label(s.class_id),'status',s.status,'answers',public.browser_answers(s.answers),'version',s.version,'submittedBy',s.submitted_by,'updatedBy',s.updated_by,'updatedAt',s.updated_at,'history',coalesce((select jsonb_agg(jsonb_build_object('by',changed_by,'at',created_at,'action','저장','answers',public.browser_answers(answers)) order by version) from public.class_task_submission_revisions where submission_id=s.id),'[]'))) from public.class_task_submissions s),'[]'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'category',e.category,'date',e.starts_at,'deadline',e.application_deadline,'place',e.place,'method',lower(e.method),'capacity',e.capacity,'taskId',e.class_task_id,'color',e.color,'applications',coalesce((select jsonb_agg(user_id) from public.event_applications where event_id=e.id and status='APPLIED'),'[]'))) from public.school_events e),'[]'),
 'suggestions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'authorId',s.author_id,'title',s.title,'content',s.content,'category',s.category,'date',s.created_at,'updatedAt',s.updated_at,'status',case s.status when 'RECEIVED' then '접수 완료' when 'REVIEWING' then '검토 중' when 'ASSIGNED' then '담당자 전달' when 'RESOLVED' then '처리 완료' else '반려' end,'assignedTo',(select user_id from public.suggestion_assignments where suggestion_id=s.id limit 1),'visibility',s.visibility,'publicationStatus',s.publication_status,'moderationReasons',s.moderation_reasons,'replies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'authorId',r.author_id,'author',coalesce(rp.display_name,'탈퇴 회원'),'content',r.content,'date',r.created_at,'updatedAt',r.updated_at,'status',r.publication_status) order by r.created_at) from public.suggestion_replies r left join public.profiles rp on rp.id=r.author_id where r.suggestion_id=s.id),'[]'),'reply',(select content from public.suggestion_replies where suggestion_id=s.id and publication_status='APPROVED' order by created_at desc limit 1))) from public.suggestions s),'[]'),
 'pledges',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'details',details,'department',department,'progress',progress,'status',case status when 'PLANNED' then '추진 예정' when 'ONGOING' then '추진 중' when 'COMPLETED' then '완료' else '보류' end,'updated',updated_at)) from public.pledges),'[]'),
 'surveys',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'options',s.options,'deadline',s.deadline,'responses',coalesce((select jsonb_object_agg(user_id,answer#>>'{}') from public.survey_responses where survey_id=s.id),'{}'))) from public.surveys s),'[]'),
 'mentoring',coalesce((select jsonb_agg(jsonb_build_object('id',id,'memberId',user_id,'kind',kind,'goal',goal,'status',status,'partnerId',partner_id)) from public.school_life_mentoring),'[]'),
 'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'recipientId',recipient_id,'title',title,'href',href,'read',read_at is not null,'date',created_at) order by created_at desc) from public.notifications),'[]'),
 'logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'by',coalesce(p.display_name,'탈퇴 회원'),'action',l.action,'date',l.created_at) order by l.created_at desc) from public.audit_logs l left join public.profiles p on p.id=l.actor_id),'[]'),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'postId',post_id,'by',reporter_id,'reason',reason)) from public.post_reports),'[]'));
 return result;
end $$;

commit;
