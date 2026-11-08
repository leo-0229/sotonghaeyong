-- Policy revision: provisioned accounts, editable submissions, school-life mentoring.
begin;
alter table public.profiles add column gender text check(gender in ('MALE','FEMALE'));
revoke select on public.profiles from authenticated;
grant select(id,display_name,class_id,status,created_at,updated_at) on public.profiles to authenticated;
alter table public.posts add column moderation_reasons text[] not null default '{}';
alter table public.posts add column moderation_source text not null default 'MANUAL';
alter table public.pledges add column details text not null default '';
alter table public.school_events add column category text not null default '학교 행사';
alter table public.school_events add column color text not null default 'blue';
revoke insert(board_id,author_id,title,content,status) on public.posts from authenticated;

create table public.school_life_mentoring(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('멘토','멘티')), available_time text not null check(char_length(available_time) between 1 and 100),
 goal text not null check(char_length(goal) between 5 and 1000),
 status text not null default '매칭 대기' check(status in ('매칭 대기','매칭 완료','활동 종료')),
 partner_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(),
 check(partner_id is null or partner_id<>user_id)
);
create unique index school_life_one_active on public.school_life_mentoring(user_id) where status<>'활동 종료';
alter table public.school_life_mentoring enable row level security;
grant select on public.school_life_mentoring to authenticated;
create policy mentoring_v2_read on public.school_life_mentoring for select to authenticated using(public.current_level()>0 and (user_id=auth.uid() or public.current_level()>=3));

create function public.profile_gender(p_user uuid) returns text language sql stable security definer set search_path=pg_catalog,public as $$
 select gender from public.profiles where id=p_user and public.current_level()>0 and (p_user=auth.uid() or public.current_level()>=3);
$$;
create function public.class_label(p_class uuid) returns text language sql stable set search_path=pg_catalog,public as $$
 select grade||'-'||room from public.school_classes where id=p_class;
$$;
create function public.resolve_class(p_label text) returns uuid language sql stable set search_path=pg_catalog,public as $$
 select id from public.school_classes where grade||'-'||room=p_label and school_year=extract(year from now() at time zone 'Asia/Seoul')::int;
$$;
create function public.browser_answers(p_answers jsonb) returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select coalesce(jsonb_object_agg(key,case when jsonb_typeof(value)='array' then (select string_agg(v,'|' order by n) from jsonb_array_elements_text(value) with ordinality as a(v,n)) else value#>>'{}' end),'{}') from jsonb_each(p_answers);
$$;

-- Remove the old irreversible acceptance workflow. Existing accepted rows remain editable.
update public.class_task_submissions set status='SUBMITTED',feedback=null where status in ('ACCEPTED','CLOSED','RESUBMITTED','REVISION_REQUESTED');
create or replace function public.review_class_submission(p_id uuid,p_expected_version int,p_decision text,p_feedback text default null)
returns public.class_task_submissions language plpgsql security definer set search_path=pg_catalog,public as $$
begin raise exception 'REVIEW_DISABLED_CONTACT_REPRESENTATIVE'; end $$;

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

create function public.community_snapshot() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 result=jsonb_build_object('currentMemberId',auth.uid(),'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'classId',coalesce(public.class_label(p.class_id),''),'status',p.status,'gender',public.profile_gender(p.id),'role',coalesce((select role_code from public.user_roles where user_id=p.id),'STUDENT'),'position',(select position from public.class_officer_assignments where user_id=p.id and active))) from public.profiles p),'[]'),
 'posts','[]'::jsonb,'tasks','[]'::jsonb,'submissions','[]'::jsonb,'events','[]'::jsonb,'suggestions','[]'::jsonb,'pledges','[]'::jsonb,'surveys','[]'::jsonb,'mentoring','[]'::jsonb,'notifications','[]'::jsonb,'logs','[]'::jsonb,'reports','[]'::jsonb);
 if public.current_level()=0 then return result; end if;
 result=result||jsonb_build_object(
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'board',b.slug,'title',p.title,'content',p.content,'authorId',p.author_id,'author',coalesce(a.display_name,'탈퇴 회원'),'date',p.created_at,'views',p.views,'status',p.status,'pinned',p.pinned,'moderationReasons',p.moderation_reasons,'reason',(select reason from public.post_reviews where post_id=p.id order by created_at desc limit 1),'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'authorId',c.author_id,'author',coalesce(cp.display_name,'탈퇴 회원'),'content',c.content,'date',c.created_at,'status',c.status)) from public.comments c left join public.profiles cp on cp.id=c.author_id where c.post_id=p.id),'[]'))) from public.posts p join public.boards b on b.id=p.board_id left join public.profiles a on a.id=p.author_id),'[]'),
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

create function public.community_mutate(p_operation text,p_payload jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
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
  insert into public.school_life_mentoring(id,user_id,kind,available_time,goal) values((item->>'id')::uuid,actor,item->>'kind',btrim(item->>'time'),btrim(item->>'goal'));
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
 elsif p_operation='save_suggestion' then
  item=p_payload->'suggestion';select * into old from public.suggestions where id=(item->>'id')::uuid for update;
  if not found then insert into public.suggestions(id,author_id,title,category,content) values((item->>'id')::uuid,actor,item->>'title',item->>'category',item->>'content');
  elsif item ? 'reply' and item->>'reply' is not null and (item->>'status')='처리 완료' then
   if lvl<3 or (lvl<>5 and not exists(select 1 from public.suggestion_assignments where suggestion_id=old.id and user_id=actor)) then raise exception 'ASSIGNEE_REQUIRED';end if;
   if char_length(btrim(item->>'reply')) not between 5 and 3000 then raise exception 'INVALID_REPLY';end if;
   insert into public.suggestion_replies(suggestion_id,author_id,content) values(old.id,actor,item->>'reply');update public.suggestions set status='RESOLVED' where id=old.id;
   insert into public.notifications(recipient_id,title,href) values(old.author_id,'건의 답변이 등록되었습니다.','/suggestions/mine');
  else
   if lvl<>5 then raise exception 'TEACHER_REQUIRED';end if;
   if nullif(item->>'assignedTo','') is not null and not exists(select 1 from public.profiles p join public.user_roles u on u.user_id=p.id join public.roles r on r.code=u.role_code where p.id=(item->>'assignedTo')::uuid and p.status='ACTIVE' and r.level>=3) then raise exception 'INVALID_ASSIGNEE';end if;
   delete from public.suggestion_assignments where suggestion_id=old.id;
   if nullif(item->>'assignedTo','') is not null then insert into public.suggestion_assignments values(old.id,(item->>'assignedTo')::uuid,actor);end if;update public.suggestions set status='ASSIGNED' where id=old.id;
  end if;
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
   insert into public.comments(id,post_id,author_id,content) values((item->>'id')::uuid,(p_payload->>'postId')::uuid,actor,item->>'content');
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
 elsif p_operation='moderation_settings' then
  if lvl<>5 then raise exception 'TEACHER_REQUIRED';end if;
  if jsonb_typeof(p_payload->'teacherNames') is distinct from 'array' or jsonb_array_length(p_payload->'teacherNames') not between 1 and 200 then raise exception 'TEACHER_ROSTER_REQUIRED';end if;
  insert into public.site_settings(key,value) values('moderation',jsonb_build_object('teacherNames',p_payload->'teacherNames','enabled',true)) on conflict(key) do update set value=excluded.value;
 elsif p_operation='withdraw' then
  if lvl=5 then raise exception 'TRANSFER_TEACHER_FIRST';end if;
  delete from public.posts where author_id=actor;delete from public.comments where author_id=actor;delete from public.suggestions where author_id=actor;delete from public.school_life_mentoring where user_id=actor;delete from public.event_applications where user_id=actor;delete from public.survey_responses where user_id=actor;delete from public.notifications where recipient_id=actor;delete from public.class_officer_assignments where user_id=actor;
  update public.profiles set display_name='탈퇴 회원',status='WITHDRAWN',gender=null where id=actor;
 else raise exception 'UNKNOWN_OPERATION';end if;
 insert into public.audit_logs(actor_id,action) values(actor,'community.'||p_operation);
end $$;

create table public.post_check_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now());
alter table public.post_check_requests enable row level security;
create index post_check_rate_idx on public.post_check_requests(user_id,created_at);
create function public.reserve_post_check(p_user uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,1));
 if not exists(select 1 from public.profiles where id=p_user and status='ACTIVE') then raise exception 'ACTIVE_MEMBER_REQUIRED';end if;
 if (select count(*) from public.post_check_requests where user_id=p_user and created_at>now()-interval '1 minute')>=5 then raise exception 'RATE_LIMITED';end if;
 delete from public.post_check_requests where user_id=p_user and created_at<now()-interval '1 hour';insert into public.post_check_requests(user_id) values(p_user);
end $$;
create function public.store_moderated_post(p_user uuid,p_board text,p_title text,p_content text,p_status text,p_reasons text[],p_id uuid default null) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=coalesce(p_id,gen_random_uuid());lvl int;board public.boards;begin
 select r.level into lvl from public.profiles p join public.user_roles u on u.user_id=p.id join public.roles r on r.code=u.role_code where p.id=p_user and p.status='ACTIVE';if lvl is null then raise exception 'ACTIVE_MEMBER_REQUIRED';end if;
 select * into board from public.boards where slug=p_board;if not found or (board.official and lvl<4) then raise exception 'BOARD_PERMISSION_DENIED';end if;
 if p_status not in ('DRAFT','PENDING','APPROVED') or p_status is null then raise exception 'INVALID_STATUS';end if;
 if p_id is not null then
  perform 1 from public.posts where id=p_id and author_id=p_user and status in ('DRAFT','REJECTED') for update;if not found then raise exception 'NOT_EDITABLE_POST';end if;
  insert into public.post_revisions(post_id,editor_id,title,content) select id,p_user,title,content from public.posts where id=p_id;
  update public.posts set board_id=board.id,title=p_title,content=p_content,status=p_status,moderation_reasons=p_reasons,moderation_source='RULES_AND_AI' where id=p_id;
 else insert into public.posts(id,board_id,author_id,title,content,status,moderation_reasons,moderation_source) values(result,board.id,p_user,p_title,p_content,p_status,p_reasons,'RULES_AND_AI');end if;
 insert into public.audit_logs(actor_id,action,resource_id) values(p_user,'post.automated_check',result);return result;
end $$;

revoke all on function public.profile_gender(uuid),public.class_label(uuid),public.resolve_class(text),public.browser_answers(jsonb),public.community_snapshot(),public.community_mutate(text,jsonb),public.reserve_post_check(uuid),public.store_moderated_post(uuid,text,text,text,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.profile_gender(uuid),public.class_label(uuid),public.resolve_class(text),public.browser_answers(jsonb),public.community_snapshot(),public.community_mutate(text,jsonb) to authenticated;
grant execute on function public.reserve_post_check(uuid),public.store_moderated_post(uuid,text,text,text,text,text[],uuid) to service_role;
commit;
