begin;
create or replace function public.community_snapshot() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 result=jsonb_build_object('currentMemberId',auth.uid(),'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'classId',coalesce(public.class_label(p.class_id),''),'status',p.status,'gender',public.profile_gender(p.id),'role',coalesce((select role_code from public.user_roles where user_id=p.id),'STUDENT'),'position',(select position from public.class_officer_assignments where user_id=p.id and active))) from public.profiles p),'[]'),
 'posts','[]'::jsonb,'tasks','[]'::jsonb,'submissions','[]'::jsonb,'events','[]'::jsonb,'suggestions','[]'::jsonb,'pledges','[]'::jsonb,'surveys','[]'::jsonb,'mentoring','[]'::jsonb,'notifications','[]'::jsonb,'logs','[]'::jsonb,'reports','[]'::jsonb);
 if public.current_level()=0 then return result; end if;
 result=result||jsonb_build_object(
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'board',b.slug,'title',p.title,'prefix',p.prefix,'updatedAt',p.updated_at,'content',p.content,'authorId',p.author_id,'author',coalesce(a.display_name,'탈퇴 회원'),'date',p.created_at,'views',p.views,'hearts',public.heart_summary('post',p.id),'status',p.status,'pinned',p.pinned,'moderationReasons',p.moderation_reasons,'reason',case when p.status='REJECTED' then (select reason from public.post_reviews where post_id=p.id order by created_at desc limit 1) else null end,'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'authorId',c.author_id,'author',coalesce(cp.display_name,'탈퇴 회원'),'content',c.content,'date',c.created_at,'parentId',c.parent_id,'hearts',public.heart_summary('comment',c.id),'moderationReasons',c.moderation_reasons,'status',c.status)) from public.comments c left join public.profiles cp on cp.id=c.author_id where c.post_id=p.id),'[]'))) from public.posts p join public.boards b on b.id=p.board_id left join public.profiles a on a.id=p.author_id),'[]'),
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'department',t.department,'type',case t.task_type when 'EVENT' then '행사 참가' when 'OPINION' then '의견 제출' when 'DOCUMENT' then '자료 제출' when 'SURVEY' then '대표 설문' else '일반 업무' end,'start',t.starts_at,'deadline',t.deadline,'allowLate',t.allow_late,'closed',t.closed,'managerIds',coalesce((select jsonb_agg(user_id) from public.class_task_managers where task_id=t.id),'[]'),'submittedCount',public.class_submission_count(t.id),'targets',coalesce((select jsonb_agg(public.class_label(class_id)) from public.class_task_targets where task_id=t.id),'[]'),'fields',coalesce((select jsonb_agg(jsonb_build_object('id',field_key,'label',label,'type',field_type,'required',required,'options',options) order by sort_order) from public.class_task_form_fields where task_id=t.id),'[]'))) from public.class_tasks t),'[]'),
 'submissions',coalesce((select jsonb_agg(jsonb_build_object('taskId',s.task_id,'classId',public.class_label(s.class_id),'status',s.status,'answers',public.browser_answers(s.answers),'version',s.version,'submittedBy',s.submitted_by,'updatedBy',s.updated_by,'updatedAt',s.updated_at,'history',coalesce((select jsonb_agg(jsonb_build_object('by',changed_by,'at',created_at,'action','저장','answers',public.browser_answers(answers)) order by version) from public.class_task_submission_revisions where submission_id=s.id),'[]'))) from public.class_task_submissions s),'[]'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'category',e.category,'date',e.starts_at,'deadline',e.application_deadline,'place',e.place,'method',lower(e.method),'capacity',e.capacity,'taskId',e.class_task_id,'color',e.color,'applications',coalesce((select jsonb_agg(user_id) from public.event_applications where event_id=e.id and status='APPLIED'),'[]'))) from public.school_events e),'[]'),
 'suggestions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'authorId',s.author_id,'title',s.title,'content',s.content,'category',s.category,'date',s.created_at,'status',case s.status when 'RECEIVED' then '접수 완료' when 'REVIEWING' then '검토 중' when 'ASSIGNED' then '담당자 전달' when 'RESOLVED' then '처리 완료' else '반려' end,'assignedTo',(select user_id from public.suggestion_assignments where suggestion_id=s.id limit 1),'visibility',s.visibility,'publicationStatus',s.publication_status,'moderationReasons',s.moderation_reasons,'replies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'authorId',r.author_id,'author',coalesce(rp.display_name,'탈퇴 회원'),'content',r.content,'date',r.created_at,'status',r.publication_status) order by r.created_at) from public.suggestion_replies r left join public.profiles rp on rp.id=r.author_id where r.suggestion_id=s.id),'[]'),'reply',(select content from public.suggestion_replies where suggestion_id=s.id and publication_status='APPROVED' order by created_at desc limit 1))) from public.suggestions s),'[]'),
 'pledges',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'details',details,'department',department,'progress',progress,'status',case status when 'PLANNED' then '추진 예정' when 'ONGOING' then '추진 중' when 'COMPLETED' then '완료' else '보류' end,'updated',updated_at)) from public.pledges),'[]'),
 'surveys',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'options',s.options,'deadline',s.deadline,'responses',coalesce((select jsonb_object_agg(user_id,answer#>>'{}') from public.survey_responses where survey_id=s.id),'{}'))) from public.surveys s),'[]'),
 'mentoring',coalesce((select jsonb_agg(jsonb_build_object('id',id,'memberId',user_id,'kind',kind,'goal',goal,'status',status,'partnerId',partner_id)) from public.school_life_mentoring),'[]'),
 'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'recipientId',recipient_id,'title',title,'href',href,'read',read_at is not null,'date',created_at) order by created_at desc) from public.notifications),'[]'),
 'logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'by',coalesce(p.display_name,'탈퇴 회원'),'action',l.action,'date',l.created_at) order by l.created_at desc) from public.audit_logs l left join public.profiles p on p.id=l.actor_id),'[]'),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'postId',post_id,'by',reporter_id,'reason',reason)) from public.post_reports),'[]'));
 return result;
end $$;



create or replace function public.community_mutate(p_operation text,p_payload jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid=auth.uid(); lvl int=public.current_level(); item jsonb; v_task uuid; cls uuid; field jsonb; ord int=0; old public.suggestions; a public.school_life_mentoring; b public.school_life_mentoring; sex text; event public.school_events; member_role text; row_id uuid; begin
 if lvl=0 then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or pg_column_size(p_payload)>131072 then raise exception 'INVALID_PAYLOAD'; end if;
 if p_operation='save_pledge' then
  if lvl<4 then raise exception 'EXECUTIVE_REQUIRED'; end if; item=p_payload->'pledge';
  if char_length(btrim(item->>'title')) not between 2 and 100 or char_length(btrim(item->>'description')) not between 2 and 1000 or char_length(coalesce(item->>'details',''))>10000 or char_length(btrim(item->>'department')) not between 1 and 50 or item->>'status' not in ('추진 예정','추진 중','완료','보류') then raise exception 'INVALID_PLEDGE'; end if;
  insert into public.pledges(id,title,description,details,department,progress,status) values((item->>'id')::uuid,btrim(item->>'title'),btrim(item->>'description'),coalesce(item->>'details',''),btrim(item->>'department'),(item->>'progress')::int,case item->>'status' when '추진 예정' then 'PLANNED' when '추진 중' then 'ONGOING' when '완료' then 'COMPLETED' else 'ON_HOLD' end)
  on conflict(id) do update set title=excluded.title,description=excluded.description,details=excluded.details,department=excluded.department,progress=excluded.progress,status=excluded.status;
 elsif p_operation='create_task' then
  if lvl<4 then raise exception 'EXECUTIVE_REQUIRED'; end if; item=p_payload->'task';v_task=(item->>'id')::uuid;
  if jsonb_typeof(item->'targets') is distinct from 'array' or jsonb_typeof(item->'fields') is distinct from 'array' then raise exception 'INVALID_FORM';end if;
  if jsonb_array_length(item->'targets') not between 1 and 90 or jsonb_array_length(item->'fields') not between 1 and 30 then raise exception 'INVALID_FORM'; end if;
  insert into public.class_tasks(id,title,description,department,task_type,starts_at,deadline,allow_late,created_by) values(v_task,item->>'title',item->>'description',item->>'department',case item->>'type' when '행사 참가' then 'EVENT' when '의견 제출' then 'OPINION' when '자료 제출' then 'DOCUMENT' when '대표 설문' then 'SURVEY' else 'GENERAL' end,(item->>'start')::timestamptz,(item->>'deadline')::timestamptz,coalesce((item->>'allowLate')::boolean,false),actor);
  for sex in select distinct jsonb_array_elements_text(item->'targets') loop cls=public.resolve_class(sex);if cls is null then raise exception 'INVALID_CLASS';end if;insert into public.class_task_targets values(v_task,cls);end loop;
  for field in select * from jsonb_array_elements(item->'fields') loop
   if coalesce(field->>'id','')!~'^[A-Za-z0-9_-]{1,100}$' or char_length(btrim(field->>'label')) not between 1 and 100 then raise exception 'INVALID_FIELD';end if;
   insert into public.class_task_form_fields(task_id,field_key,label,field_type,required,options,sort_order) values(v_task,field->>'id',btrim(field->>'label'),field->>'type',coalesce((field->>'required')::boolean,false),coalesce(field->'options','[]'),ord);ord=ord+1;
  end loop;
  insert into public.notifications(recipient_id,title,href) select ca.user_id,'새 학급 업무: '||(item->>'title'),'/class-tasks/'||v_task from public.class_officer_assignments ca join public.profiles p on p.id=ca.user_id join public.user_roles ur on ur.user_id=p.id where ca.active and p.status='ACTIVE' and ur.role_code='CLASS_OFFICER' and exists(select 1 from public.class_task_targets t where t.task_id=v_task and t.class_id=ca.class_id);
 elsif p_operation='close_task' then
  if lvl<4 then raise exception 'EXECUTIVE_REQUIRED';end if;update public.class_tasks set closed=(p_payload->>'closed')::boolean where id=(p_payload->>'id')::uuid;
 elsif p_operation='apply_mentoring' then
  item=p_payload->'application';select gender into sex from public.profiles where id=actor;if sex is null then raise exception 'VERIFIED_GENDER_REQUIRED';end if;
  insert into public.school_life_mentoring(id,user_id,kind,available_time,goal) values((item->>'id')::uuid,actor,item->>'kind','별도 협의',btrim(item->>'goal'));
 elsif p_operation='match_mentoring' then
  if lvl<3 then raise exception 'COUNCIL_REQUIRED';end if;
  if jsonb_typeof(p_payload->'ids') is distinct from 'array' or jsonb_array_length(p_payload->'ids')<>2 then raise exception 'INVALID_PAIR';end if;
  perform 1 from public.school_life_mentoring where id in (select v::uuid from jsonb_array_elements_text(p_payload->'ids') v) order by id for update;
  select * into a from public.school_life_mentoring where id in (select v::uuid from jsonb_array_elements_text(p_payload->'ids') v) and kind='멘토';
  select * into b from public.school_life_mentoring where id in (select v::uuid from jsonb_array_elements_text(p_payload->'ids') v) and kind='멘티';
  if a.id is null or b.id is null or a.user_id=b.user_id or a.status<>'매칭 대기' or b.status<>'매칭 대기' then raise exception 'INVALID_PAIR';end if;
  select gender into sex from public.profiles where id=a.user_id and status='ACTIVE';
  if sex is null or not exists(select 1 from public.profiles where id=b.user_id and status='ACTIVE' and gender=sex) then raise exception 'SAME_GENDER_REQUIRED';end if;
  update public.school_life_mentoring set status='매칭 완료',partner_id=case when id=a.id then b.user_id else a.user_id end where id in (a.id,b.id);
  insert into public.notifications(recipient_id,title,href) values(a.user_id,'학교생활 멘토·멘티가 매칭되었습니다.','/mentoring'),(b.user_id,'학교생활 멘토·멘티가 매칭되었습니다.','/mentoring');
 elsif p_operation='save_suggestion' then raise exception 'USE_MODERATED_SUGGESTION_ENDPOINT';
 elsif p_operation='apply_event' then
  select * into event from public.school_events where id=(p_payload->>'id')::uuid for update;
  if not found or event.method<>'INDIVIDUAL' or now()<event.application_starts_at or now()>event.application_deadline then raise exception 'EVENT_NOT_OPEN';end if;
  if (p_payload->>'apply')::boolean and (select count(*) from public.event_applications where event_id=event.id and status='APPLIED' and user_id<>actor)>=event.capacity then raise exception 'EVENT_FULL';end if;
  insert into public.event_applications(event_id,user_id,status) values(event.id,actor,case when (p_payload->>'apply')::boolean then 'APPLIED' else 'CANCELLED' end) on conflict(event_id,user_id) do update set status=excluded.status;
 elsif p_operation='answer_survey' then
  if not exists(select 1 from public.surveys where id=(p_payload->>'id')::uuid and deadline>=now() and options @> jsonb_build_array(p_payload->>'answer')) then raise exception 'INVALID_SURVEY_RESPONSE';end if;
  insert into public.survey_responses values((p_payload->>'id')::uuid,actor,to_jsonb(p_payload->>'answer'),now());
 elsif p_operation='review_post' then perform public.review_post((p_payload->>'id')::uuid,p_payload->>'decision',p_payload->>'reason');
 elsif p_operation='comment' then
  item=p_payload->'comment';
  if exists(select 1 from public.comments where id=(item->>'id')::uuid) then
   if lvl<3 or exists(select 1 from public.comments where id=(item->>'id')::uuid and author_id=actor) then raise exception 'OTHER_REVIEWER_REQUIRED';end if;
   update public.comments set status='APPROVED' where id=(item->>'id')::uuid;
  else
   if not exists(select 1 from public.posts where id=(p_payload->>'postId')::uuid and status='APPROVED') then raise exception 'PUBLIC_POST_REQUIRED';end if;
   raise exception 'USE_MODERATED_COMMENT_ENDPOINT';
  end if;
 elsif p_operation='report_post' then item=p_payload->'report';insert into public.post_reports(post_id,reporter_id,reason) values((item->>'postId')::uuid,actor,item->>'reason');
 elsif p_operation='read_notifications' then update public.notifications set read_at=now() where recipient_id=actor and id in (select v::uuid from jsonb_array_elements_text(p_payload->'ids') v);
 elsif p_operation='member_role' then
  perform public.set_member_role((p_payload->>'userId')::uuid,p_payload->>'role',public.resolve_class(p_payload->>'classId'),p_payload->>'position');
 elsif p_operation='member_status' then
  if lvl<>5 then raise exception 'TEACHER_REQUIRED';end if;row_id=(p_payload->>'userId')::uuid;
  if exists(select 1 from public.user_roles where user_id=row_id and role_code='SUPERVISING_TEACHER') then raise exception 'TEACHER_BOOTSTRAP_ONLY';end if;
  if p_payload->>'status' not in ('ACTIVE','REJECTED','SUSPENDED') then raise exception 'INVALID_STATUS';end if;
  update public.profiles set status=p_payload->>'status' where id=row_id;
 elsif p_operation='moderation_settings' then raise exception 'TEACHER_NAME_CHECK_DISABLED';
 elsif p_operation='withdraw' then
  if lvl=5 then raise exception 'TRANSFER_TEACHER_FIRST';end if;
  delete from public.posts where author_id=actor;delete from public.comments where author_id=actor;delete from public.suggestions where author_id=actor;delete from public.school_life_mentoring where user_id=actor;delete from public.event_applications where user_id=actor;delete from public.survey_responses where user_id=actor;delete from public.notifications where recipient_id=actor;delete from public.class_officer_assignments where user_id=actor;
  update public.profiles set display_name='탈퇴 회원',status='WITHDRAWN',gender=null where id=actor;
 else raise exception 'UNKNOWN_OPERATION';end if;
 insert into public.audit_logs(actor_id,action) values(actor,'community.'||p_operation);
end $$;


create or replace function public.submit_class_task(p_task uuid,p_answers jsonb,p_expected_version int,p_draft boolean default false)
returns public.class_task_submissions language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid=auth.uid(); cls uuid; task public.class_tasks; prev public.class_task_submissions; result public.class_task_submissions; next_status text; begin
 if p_draft is null then raise exception 'INVALID_DRAFT_FLAG'; end if;
 if public.current_level()<>2 then raise exception 'CLASS_OFFICER_REQUIRED'; end if;
 select a.class_id into cls from public.class_officer_assignments a join public.profiles p on p.id=a.user_id where a.user_id=actor and a.active and a.class_id=p.class_id;
 if cls is null then raise exception 'CLASS_ASSIGNMENT_REQUIRED'; end if;
 select * into task from public.class_tasks where id=p_task for share;
 if not found or not exists(select 1 from public.class_task_targets where task_id=p_task and class_id=cls) then raise exception 'NOT_TARGET_CLASS'; end if;
 if task.closed or now()<task.starts_at or (not task.allow_late and now()>task.deadline) then raise exception 'TASK_NOT_OPEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_task::text||':'||cls::text,0));
 select * into prev from public.class_task_submissions where task_id=p_task and class_id=cls for update;
 if prev.id is not null and now()>task.deadline then raise exception 'DEADLINE_PASSED_CONTACT_COUNCIL';end if;
 if coalesce(prev.version,0)<>p_expected_version or p_expected_version is null then raise exception 'VERSION_CONFLICT'; end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or pg_column_size(p_answers)>65536 then raise exception 'INVALID_ANSWERS'; end if;
 if not p_draft then perform public.validate_task_answers(p_task,p_answers); end if;
 next_status=case when p_draft and coalesce(prev.status,'DRAFT')='DRAFT' then 'DRAFT' else 'SUBMITTED' end;
 -- A saved change to an already submitted record is also a submitted change.
 if next_status='SUBMITTED' then perform public.validate_task_answers(p_task,p_answers); end if;
 insert into public.class_task_submissions(task_id,class_id,status,answers,version,submitted_by,updated_by)
 values(p_task,cls,next_status,p_answers,p_expected_version+1,actor,actor)
 on conflict(task_id,class_id) do update set status=excluded.status,answers=excluded.answers,version=excluded.version,updated_by=actor,feedback=null returning * into result;
 insert into public.class_task_submission_revisions(submission_id,version,answers,changed_by) values(result.id,result.version,result.answers,actor);
 insert into public.audit_logs(actor_id,action,resource_id) values(actor,'class_submission.save',result.id);
 return result;
end $$;


commit;
