begin;
insert into public.boards(slug,title,official,sort_order) values('lost','분실물 게시판',false,7) on conflict(slug) do nothing;
alter table public.posts add column prefix text not null default '' check(char_length(prefix)<=20 and prefix!~'[[:cntrl:]]');
alter table public.post_revisions add column prefix text not null default '';
alter table public.post_revisions add column board_id uuid references public.boards(id);
alter table public.post_revisions add column previous_status text;
drop function public.store_moderated_post(uuid,text,text,text,text,text[],uuid);
create function public.store_moderated_post(p_user uuid,p_board text,p_title text,p_content text,p_status text,p_reasons text[],p_id uuid default null,p_prefix text default '',p_ai_verified boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=coalesce(p_id,gen_random_uuid());lvl int;board public.boards;begin
 select r.level into lvl from public.profiles p join public.user_roles u on u.user_id=p.id join public.roles r on r.code=u.role_code where p.id=p_user and p.status='ACTIVE' and not p.credentials_pending;if lvl is null then raise exception 'ACTIVE_MEMBER_REQUIRED';end if;
 select * into board from public.boards where slug=p_board;if not found or (board.official and lvl<4) then raise exception 'BOARD_PERMISSION_DENIED';end if;
 if p_status is null or p_status not in ('DRAFT','PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_ai_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'AI_OR_HUMAN_APPROVAL_REQUIRED';end if;
 if p_prefix is null or char_length(btrim(p_prefix))>20 or p_prefix~'[[:cntrl:]]' then raise exception 'INVALID_PREFIX';end if;
 if p_id is not null then
  perform 1 from public.posts where id=p_id and author_id=p_user and status in ('DRAFT','REJECTED','PENDING','APPROVED') for update;
  if not found then raise exception 'NOT_EDITABLE_POST';end if;
  insert into public.post_revisions(post_id,editor_id,title,content,prefix,board_id,previous_status)
   select id,p_user,title,content,prefix,board_id,status from public.posts where id=p_id;
  update public.posts set board_id=board.id,title=p_title,content=p_content,prefix=btrim(p_prefix),status=p_status,moderation_reasons=p_reasons,moderation_source=case when p_status='APPROVED' then 'AI_APPROVED' else 'REVIEW_REQUIRED' end where id=p_id;
 else
  insert into public.posts(id,board_id,author_id,title,content,prefix,status,moderation_reasons,moderation_source)
   values(result,board.id,p_user,p_title,p_content,btrim(p_prefix),p_status,p_reasons,case when p_status='APPROVED' then 'AI_APPROVED' else 'REVIEW_REQUIRED' end);
 end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(p_user,case when p_id is null then 'post.approval_requested' else 'post.edited_reapproval_required' end,result);
 return result;
end $$;
revoke all on function public.store_moderated_post(uuid,text,text,text,text,text[],uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.store_moderated_post(uuid,text,text,text,text,text[],uuid,text,boolean) to service_role;
-- The snapshot replacement below adds the prefix and edit time without weakening RLS.
create or replace function public.community_snapshot() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 result=jsonb_build_object('currentMemberId',auth.uid(),'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'classId',coalesce(public.class_label(p.class_id),''),'status',p.status,'gender',public.profile_gender(p.id),'role',coalesce((select role_code from public.user_roles where user_id=p.id),'STUDENT'),'position',(select position from public.class_officer_assignments where user_id=p.id and active))) from public.profiles p),'[]'),
 'posts','[]'::jsonb,'tasks','[]'::jsonb,'submissions','[]'::jsonb,'events','[]'::jsonb,'suggestions','[]'::jsonb,'pledges','[]'::jsonb,'surveys','[]'::jsonb,'mentoring','[]'::jsonb,'notifications','[]'::jsonb,'logs','[]'::jsonb,'reports','[]'::jsonb);
 if public.current_level()=0 then return result; end if;
 result=result||jsonb_build_object(
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'board',b.slug,'title',p.title,'prefix',p.prefix,'updatedAt',p.updated_at,'content',p.content,'authorId',p.author_id,'author',coalesce(a.display_name,'탈퇴 회원'),'date',p.created_at,'views',p.views,'status',p.status,'pinned',p.pinned,'moderationReasons',p.moderation_reasons,'reason',case when p.status='REJECTED' then (select reason from public.post_reviews where post_id=p.id order by created_at desc limit 1) else null end,'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'authorId',c.author_id,'author',coalesce(cp.display_name,'탈퇴 회원'),'content',c.content,'date',c.created_at,'status',c.status)) from public.comments c left join public.profiles cp on cp.id=c.author_id where c.post_id=p.id),'[]'))) from public.posts p join public.boards b on b.id=p.board_id left join public.profiles a on a.id=p.author_id),'[]'),
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'department',t.department,'type',case t.task_type when 'EVENT' then '행사 참가' when 'OPINION' then '의견 제출' when 'DOCUMENT' then '자료 제출' when 'SURVEY' then '대표 설문' else '일반 업무' end,'start',t.starts_at,'deadline',t.deadline,'allowLate',t.allow_late,'closed',t.closed,'managerIds',coalesce((select jsonb_agg(user_id) from public.class_task_managers where task_id=t.id),'[]'),'targets',coalesce((select jsonb_agg(public.class_label(class_id)) from public.class_task_targets where task_id=t.id),'[]'),'fields',coalesce((select jsonb_agg(jsonb_build_object('id',field_key,'label',label,'type',field_type,'required',required,'options',options) order by sort_order) from public.class_task_form_fields where task_id=t.id),'[]'))) from public.class_tasks t),'[]'),
 'submissions',coalesce((select jsonb_agg(jsonb_build_object('taskId',s.task_id,'classId',public.class_label(s.class_id),'status',s.status,'answers',public.browser_answers(s.answers),'version',s.version,'submittedBy',s.submitted_by,'updatedBy',s.updated_by,'updatedAt',s.updated_at,'history',coalesce((select jsonb_agg(jsonb_build_object('by',changed_by,'at',created_at,'action','저장','answers',public.browser_answers(answers)) order by version) from public.class_task_submission_revisions where submission_id=s.id),'[]'))) from public.class_task_submissions s),'[]'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'category',e.category,'date',e.starts_at,'deadline',e.application_deadline,'place',e.place,'method',lower(e.method),'capacity',e.capacity,'taskId',e.class_task_id,'color',e.color,'applications',coalesce((select jsonb_agg(user_id) from public.event_applications where event_id=e.id and status='APPLIED'),'[]'))) from public.school_events e),'[]'),
 'suggestions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'authorId',s.author_id,'title',s.title,'content',s.content,'category',s.category,'date',s.created_at,'status',case s.status when 'RECEIVED' then '접수 완료' when 'REVIEWING' then '검토 중' when 'ASSIGNED' then '담당자 전달' when 'RESOLVED' then '처리 완료' else '반려' end,'assignedTo',(select user_id from public.suggestion_assignments where suggestion_id=s.id limit 1),'reply',(select content from public.suggestion_replies where suggestion_id=s.id order by created_at desc limit 1))) from public.suggestions s),'[]'),
 'pledges',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'details',details,'department',department,'progress',progress,'status',case status when 'PLANNED' then '추진 예정' when 'ONGOING' then '추진 중' when 'COMPLETED' then '완료' else '보류' end,'updated',updated_at)) from public.pledges),'[]'),
 'surveys',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'options',s.options,'deadline',s.deadline,'responses',coalesce((select jsonb_object_agg(user_id,answer#>>'{}') from public.survey_responses where survey_id=s.id),'{}'))) from public.surveys s),'[]'),
 'mentoring',coalesce((select jsonb_agg(jsonb_build_object('id',id,'memberId',user_id,'kind',kind,'time',available_time,'goal',goal,'status',status,'partnerId',partner_id)) from public.school_life_mentoring),'[]'),
 'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'recipientId',recipient_id,'title',title,'href',href,'read',read_at is not null,'date',created_at) order by created_at desc) from public.notifications),'[]'),
 'logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'by',coalesce(p.display_name,'탈퇴 회원'),'action',l.action,'date',l.created_at) order by l.created_at desc) from public.audit_logs l left join public.profiles p on p.id=l.actor_id),'[]'),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'postId',post_id,'by',reporter_id,'reason',reason)) from public.post_reports),'[]'));
 return result;
end $$;


commit;
