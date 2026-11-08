-- 명품문산: production integration foundation. Apply to a fresh Supabase project.
-- The prototype UI does not call this schema yet. No real student data is seeded.
begin;

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_year int not null check (school_year between 2020 and 2200),
  grade smallint not null check (grade between 1 and 3),
  room smallint not null check (room between 1 and 30),
  unique (school_year, grade, room)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  class_id uuid references public.school_classes(id),
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','REJECTED','SUSPENDED','WITHDRAWN')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.roles (
  code text primary key,
  level smallint not null check (level between 1 and 5),
  label text not null
);
insert into public.roles values
 ('STUDENT',1,'일반 학생'),('CLASS_OFFICER',2,'학급 대표'),('COUNCIL_OFFICER',3,'학생회 임원'),
 ('COUNCIL_EXECUTIVE',4,'학생회 회장단'),('PR_DIRECTOR',4,'대외홍보부 부장'),('SUPERVISING_TEACHER',5,'담당 교사');
create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_code text not null default 'STUDENT' references public.roles(code),
  granted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.role_permissions (
  role_code text not null references public.roles(code), permission text not null,
  primary key (role_code, permission)
);
insert into public.role_permissions values
 ('STUDENT','post:create'),('CLASS_OFFICER','class:submit'),('COUNCIL_OFFICER','post:review'),
 ('COUNCIL_EXECUTIVE','task:manage'),('PR_DIRECTOR','task:manage'),('SUPERVISING_TEACHER','member:approve');
create table public.membership_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
  class_id uuid not null references public.school_classes(id),
  student_number smallint not null check (student_number between 1 and 99),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','VERIFIED')),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.class_officer_assignments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  class_id uuid not null references public.school_classes(id),
  position text not null check (position in ('CLASS_PRESIDENT','CLASS_VICE_PRESIDENT')),
  active boolean not null default true,
  unique (class_id, position)
);
create table public.boards (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  title text not null, official boolean not null default false, sort_order int not null default 0
);
insert into public.boards(slug,title,official,sort_order) values
 ('notice','전체 공지',true,1),('council','학생회 공지',true,2),('report','학생회 활동 보고',true,3),
 ('free','자유게시판',false,4),('question','질문게시판',false,5),('info','정보공유',false,6);
create table public.posts (
  id uuid primary key default gen_random_uuid(), board_id uuid not null references public.boards(id),
  author_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 2 and 100),
  content text not null check (char_length(content) between 10 and 10000),
  status text not null default 'PENDING' check (status in ('DRAFT','PENDING','APPROVED','REJECTED','HIDDEN')),
  pinned boolean not null default false, views int not null default 0 check (views >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.post_revisions (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  editor_id uuid references public.profiles(id) on delete set null, title text not null, content text not null,
  created_at timestamptz not null default now()
);
create table public.post_reviews (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('APPROVED','REJECTED','HIDDEN')), reason text,
  created_at timestamptz not null default now()
);
create table public.comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null, content text not null check (char_length(content) between 2 and 2000),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','HIDDEN')),
  created_at timestamptz not null default now()
);
create table public.announcements (
  post_id uuid primary key references public.posts(id) on delete cascade,
  important boolean not null default false, expires_at timestamptz
);
create table public.post_reports (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'OPEN' check (status in ('OPEN','REVIEWED','CLOSED')), created_at timestamptz not null default now()
);
create table public.class_tasks (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 2 and 100),
  description text not null, department text not null,
  task_type text not null check (task_type in ('EVENT','OPINION','DOCUMENT','SURVEY','GENERAL')),
  starts_at timestamptz not null, deadline timestamptz not null,
  allow_late boolean not null default false, closed boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (deadline > starts_at)
);
create table public.class_task_managers (
  task_id uuid not null references public.class_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key(task_id,user_id)
);
create table public.class_task_targets (
  task_id uuid not null references public.class_tasks(id) on delete cascade,
  class_id uuid not null references public.school_classes(id), primary key(task_id,class_id)
);
create table public.class_task_form_fields (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.class_tasks(id) on delete cascade,
  field_key text not null, label text not null,
  field_type text not null check (field_type in ('text','textarea','number','select','multiselect','date')),
  required boolean not null default false, options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  sort_order int not null default 0, unique(task_id,field_key)
);
create table public.class_task_submissions (
  id uuid primary key default gen_random_uuid(), task_id uuid not null, class_id uuid not null,
  foreign key(task_id,class_id) references public.class_task_targets(task_id,class_id),
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','REVISION_REQUESTED','RESUBMITTED','ACCEPTED','CLOSED')),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  version int not null default 1 check (version > 0),
  submitted_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  feedback text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(task_id,class_id)
);
create table public.class_task_submission_revisions (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.class_task_submissions(id) on delete cascade,
  version int not null, answers jsonb not null, changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), unique(submission_id,version)
);
create table public.class_task_review_logs (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.class_task_submissions(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null, decision text not null check (decision in ('ACCEPTED','REVISION_REQUESTED')),
  feedback text, created_at timestamptz not null default now()
);
create table public.school_events (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null,
  starts_at timestamptz not null, place text not null, application_starts_at timestamptz not null,
  application_deadline timestamptz not null, method text not null check (method in ('INDIVIDUAL','CLASS','NONE')),
  capacity int not null check (capacity > 0), department text not null,
  status text not null default 'UPCOMING' check (status in ('UPCOMING','OPEN','CLOSED','ONGOING','FINISHED')),
  class_task_id uuid references public.class_tasks(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (application_deadline > application_starts_at), check (method <> 'CLASS' or class_task_id is not null)
);
create table public.event_applications (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.school_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'APPLIED' check (status in ('APPLIED','CANCELLED')),
  created_at timestamptz not null default now(), unique(event_id,user_id)
);
create table public.suggestions (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  category text not null check (category in ('학교 시설','학교 행사','학생회','급식','생활 환경','기타')),
  content text not null check (char_length(content) between 10 and 5000),
  status text not null default 'RECEIVED' check (status in ('RECEIVED','REVIEWING','ASSIGNED','RESOLVED','REJECTED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.suggestion_assignments (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null, primary key(suggestion_id,user_id)
);
create table public.suggestion_replies (
  id uuid primary key default gen_random_uuid(), suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null, content text not null,
  created_at timestamptz not null default now()
);
create table public.mentor_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null, available_time text not null, introduction text not null,
  status text not null default 'PENDING' check (status in ('PENDING','MATCHED','FINISHED','CANCELLED')),
  created_at timestamptz not null default now()
);
create table public.mentee_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null, available_time text not null, goal text not null,
  status text not null default 'PENDING' check (status in ('PENDING','MATCHED','FINISHED','CANCELLED')),
  created_at timestamptz not null default now()
);
create unique index mentor_one_pending on public.mentor_applications(user_id) where status in ('PENDING','MATCHED');
create unique index mentee_one_pending on public.mentee_applications(user_id) where status in ('PENDING','MATCHED');
create table public.mentor_matches (
  id uuid primary key default gen_random_uuid(), mentor_application_id uuid not null unique references public.mentor_applications(id) on delete cascade,
  mentee_application_id uuid not null unique references public.mentee_applications(id) on delete cascade,
  matched_by uuid references public.profiles(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','FINISHED','CANCELLED')), created_at timestamptz not null default now()
);
create table public.pledges (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null,
  department text not null, progress smallint not null default 0 check (progress between 0 and 100),
  status text not null default 'PLANNED' check (status in ('PLANNED','ONGOING','COMPLETED','ON_HOLD')),
  updated_at timestamptz not null default now()
);
create table public.surveys (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'), deadline timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.survey_responses (
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer jsonb not null, created_at timestamptz not null default now(), primary key(survey_id,user_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, href text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  action text not null, resource_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.site_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);

create index profiles_class_idx on public.profiles(class_id);
create index membership_status_idx on public.membership_requests(status,created_at);
create index posts_board_date_idx on public.posts(board_id,status,created_at desc);
create index posts_author_idx on public.posts(author_id,status);
create index comments_post_idx on public.comments(post_id,status);
create index tasks_deadline_idx on public.class_tasks(deadline) where not closed;
create index task_targets_class_idx on public.class_task_targets(class_id,task_id);
create index submissions_status_idx on public.class_task_submissions(task_id,status);
create index suggestions_author_idx on public.suggestions(author_id,created_at desc);
create index suggestion_assignee_idx on public.suggestion_assignments(user_id,suggestion_id);
create index notifications_recipient_idx on public.notifications(recipient_id,created_at desc);
create index audit_date_idx on public.audit_logs(created_at desc);

create function public.current_level() returns int language sql stable security definer set search_path = pg_catalog, public as $$
 select coalesce((select r.level::int from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.code=ur.role_code where p.id=auth.uid() and p.status='ACTIVE'),0);
$$;
create function public.manages_task(p_task uuid) returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
 select public.current_level() >= 4 or (public.current_level() = 3 and exists(select 1 from public.class_task_managers where task_id=p_task and user_id=auth.uid()));
$$;
create function public.represents_class(p_class uuid) returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
 select public.current_level() = 2 and exists(select 1 from public.class_officer_assignments a join public.profiles p on p.id=a.user_id where a.user_id=auth.uid() and a.class_id=p_class and p.class_id=p_class and a.active);
$$;
create function public.reads_suggestion(p_id uuid) returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
 select public.current_level()>0 and (public.current_level()=5 or exists(select 1 from public.suggestions where id=p_id and author_id=auth.uid()) or (public.current_level()>=3 and exists(select 1 from public.suggestion_assignments where suggestion_id=p_id and user_id=auth.uid())));
$$;
create function public.touch_updated_at() returns trigger language plpgsql set search_path = pg_catalog, public as $$ begin new.updated_at=now(); return new; end; $$;

-- Default deny for every table, including future feature foundations.
do $$ declare t text; begin
  foreach t in array array['school_classes','profiles','roles','user_roles','role_permissions','membership_requests','class_officer_assignments','boards','posts','post_revisions','post_reviews','comments','announcements','post_reports','class_tasks','class_task_managers','class_task_targets','class_task_form_fields','class_task_submissions','class_task_submission_revisions','class_task_review_logs','school_events','event_applications','suggestions','suggestion_assignments','suggestion_replies','mentor_applications','mentee_applications','mentor_matches','pledges','surveys','survey_responses','notifications','audit_logs','site_settings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
  foreach t in array array['profiles','user_roles','membership_requests','posts','class_tasks','class_task_submissions','school_events','suggestions','pledges','site_settings'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
  end loop;
end $$;

create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or (public.current_level()>0 and status='ACTIVE') or public.current_level()=5);
create policy classes_read on public.school_classes for select to authenticated using (true);
create policy roles_read on public.roles for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.current_level()>0);
create policy user_role_read on public.user_roles for select to authenticated using (user_id=auth.uid() or public.current_level()=5);
create policy membership_read on public.membership_requests for select to authenticated using (user_id=auth.uid() or public.current_level()=5);
create policy officer_read on public.class_officer_assignments for select to authenticated using (user_id=auth.uid() or public.current_level()>=3);
create policy boards_read on public.boards for select to authenticated using (public.current_level()>0);
create policy posts_read on public.posts for select to authenticated using (public.current_level()>0 and (status='APPROVED' or author_id=auth.uid() or public.current_level()>=3));
create policy comments_read on public.comments for select to authenticated using (public.current_level()>0 and (author_id=auth.uid() or public.current_level()>=3 or (status='APPROVED' and exists(select 1 from public.posts p where p.id=post_id and p.status='APPROVED'))));
create policy post_revisions_read on public.post_revisions for select to authenticated using (exists(select 1 from public.posts p where p.id=post_id and (p.author_id=auth.uid() or public.current_level()>=3)));
create policy post_reviews_read on public.post_reviews for select to authenticated using (exists(select 1 from public.posts p where p.id=post_id and (p.author_id=auth.uid() or public.current_level()>=3)));
create policy announcements_read on public.announcements for select to authenticated using (exists(select 1 from public.posts p where p.id=post_id and p.status='APPROVED'));
create policy reports_read on public.post_reports for select to authenticated using (public.current_level()>0 and (reporter_id=auth.uid() or public.current_level()>=3));
create policy tasks_read on public.class_tasks for select to authenticated using (public.manages_task(id) or exists(select 1 from public.class_task_targets t where t.task_id=id and public.represents_class(t.class_id)));
create policy task_managers_read on public.class_task_managers for select to authenticated using (user_id=auth.uid() or public.current_level()>=4);
create policy task_targets_read on public.class_task_targets for select to authenticated using (public.manages_task(task_id) or public.represents_class(class_id));
create policy task_fields_read on public.class_task_form_fields for select to authenticated using (exists(select 1 from public.class_tasks t where t.id=task_id));
create policy submissions_read on public.class_task_submissions for select to authenticated using (public.represents_class(class_id) or (status<>'DRAFT' and public.manages_task(task_id)));
create policy submission_revisions_read on public.class_task_submission_revisions for select to authenticated using (exists(select 1 from public.class_task_submissions s where s.id=submission_id));
create policy submission_reviews_read on public.class_task_review_logs for select to authenticated using (exists(select 1 from public.class_task_submissions s where s.id=submission_id));
create policy events_read on public.school_events for select to authenticated using (public.current_level()>0);
create policy event_applications_read on public.event_applications for select to authenticated using (public.current_level()>0 and (user_id=auth.uid() or public.current_level()>=4));
create policy suggestions_read on public.suggestions for select to authenticated using (public.reads_suggestion(id));
create policy assignments_read on public.suggestion_assignments for select to authenticated using (public.reads_suggestion(suggestion_id));
create policy replies_read on public.suggestion_replies for select to authenticated using (public.reads_suggestion(suggestion_id));
create policy mentor_read on public.mentor_applications for select to authenticated using (public.current_level()>0 and (user_id=auth.uid() or public.current_level()>=3));
create policy mentee_read on public.mentee_applications for select to authenticated using (public.current_level()>0 and (user_id=auth.uid() or public.current_level()>=3));
create policy matches_read on public.mentor_matches for select to authenticated using (public.current_level()>=3 or exists(select 1 from public.mentor_applications a where a.id=mentor_application_id and a.user_id=auth.uid() and public.current_level()>0) or exists(select 1 from public.mentee_applications a where a.id=mentee_application_id and a.user_id=auth.uid() and public.current_level()>0));
create policy pledges_read on public.pledges for select to authenticated using (public.current_level()>0);
create policy surveys_read on public.surveys for select to authenticated using (public.current_level()>0);
create policy survey_responses_read on public.survey_responses for select to authenticated using (public.current_level()>0 and (user_id=auth.uid() or public.current_level()>=3));
create policy notifications_read on public.notifications for select to authenticated using (recipient_id=auth.uid() and public.current_level()>0);
create policy audit_read on public.audit_logs for select to authenticated using (public.current_level()=5);
create policy settings_read on public.site_settings for select to authenticated using (public.current_level()=5);

-- Deliberately no direct client writes to protected tables. Use reviewed RPCs below.
create function public.validate_task_answers(p_task uuid, p_answers jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare f record; v jsonb; txt text; k text; begin
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'INVALID_ANSWERS'; end if;
  for k in select jsonb_object_keys(p_answers) loop
    if not exists(select 1 from public.class_task_form_fields where task_id=p_task and field_key=k) then raise exception 'UNKNOWN_FIELD'; end if;
  end loop;
  for f in select * from public.class_task_form_fields where task_id=p_task loop
    v=p_answers->f.field_key; txt=btrim(coalesce(p_answers->>f.field_key,''));
    if f.required and (v is null or v='null'::jsonb or txt='' or v='[]'::jsonb) then raise exception 'REQUIRED_FIELD: %',f.label; end if;
    if v is null or v='null'::jsonb or txt='' then continue; end if;
    if char_length(txt)>5000 then raise exception 'FIELD_TOO_LONG'; end if;
    if f.field_type<>'multiselect' and jsonb_typeof(v) not in ('string','number') then raise exception 'INVALID_FIELD_TYPE'; end if;
    if f.field_type='number' and txt !~ '^[0-9]{1,9}$' then raise exception 'INVALID_NUMBER'; end if;
    if f.field_type='select' and not f.options @> jsonb_build_array(txt) then raise exception 'INVALID_OPTION'; end if;
    if f.field_type='multiselect' then
      if jsonb_typeof(v)<>'array' then raise exception 'INVALID_MULTISELECT'; end if;
      if exists(select 1 from jsonb_array_elements(v) x where not f.options @> jsonb_build_array(x)) then raise exception 'INVALID_OPTION'; end if;
    end if;
    if f.field_type='date' then
      if txt !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_DATE'; end if;
      perform txt::date;
    end if;
  end loop;
end $$;

create function public.submit_class_task(p_task uuid,p_answers jsonb,p_expected_version int,p_draft boolean default false)
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
  if prev.status in ('ACCEPTED','CLOSED') then raise exception 'SUBMISSION_LOCKED'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or pg_column_size(p_answers)>65536 then raise exception 'INVALID_ANSWERS'; end if;
  if not p_draft then perform public.validate_task_answers(p_task,p_answers); end if;
  next_status=case when p_draft then 'DRAFT' when prev.status in ('REVISION_REQUESTED','RESUBMITTED') or prev.feedback is not null then 'RESUBMITTED' else 'SUBMITTED' end;
  insert into public.class_task_submissions(task_id,class_id,status,answers,version,submitted_by,updated_by)
    values(p_task,cls,next_status,p_answers,p_expected_version+1,actor,actor)
    on conflict(task_id,class_id) do update set status=excluded.status,answers=excluded.answers,version=excluded.version,updated_by=actor
    returning * into result;
  insert into public.class_task_submission_revisions(submission_id,version,answers,changed_by) values(result.id,result.version,result.answers,actor);
  insert into public.audit_logs(actor_id,action,resource_id) values(actor,'class_submission.'||lower(next_status),result.id);
  if not p_draft then
    insert into public.notifications(recipient_id,title,href)
      select a.user_id,task.title||': 제출 내용이 변경되었습니다.','/class-tasks/'||p_task from public.class_officer_assignments a join public.profiles p on p.id=a.user_id join public.user_roles r on r.user_id=p.id where a.class_id=cls and a.active and a.user_id<>actor and p.status='ACTIVE' and r.role_code='CLASS_OFFICER';
  end if;
  return result;
end $$;

create function public.review_class_submission(p_id uuid,p_expected_version int,p_decision text,p_feedback text default null)
returns public.class_task_submissions language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.class_task_submissions; task public.class_tasks; begin
  select * into item from public.class_task_submissions where id=p_id for update;
  if not found or not public.manages_task(item.task_id) then raise exception 'NOT_ASSIGNED_MANAGER'; end if;
  if item.version is distinct from p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_decision not in ('ACCEPTED','REVISION_REQUESTED') or p_decision is null or item.status not in ('SUBMITTED','RESUBMITTED') then raise exception 'INVALID_TRANSITION'; end if;
  if p_decision='REVISION_REQUESTED' and char_length(btrim(coalesce(p_feedback,'')))<2 then raise exception 'FEEDBACK_REQUIRED'; end if;
  update public.class_task_submissions set status=p_decision,feedback=p_feedback,version=version+1,updated_by=auth.uid() where id=p_id returning * into item;
  insert into public.class_task_review_logs(submission_id,reviewer_id,decision,feedback) values(p_id,auth.uid(),p_decision,p_feedback);
  insert into public.class_task_submission_revisions(submission_id,version,answers,changed_by) values(item.id,item.version,item.answers,auth.uid());
  insert into public.audit_logs(actor_id,action,resource_id) values(auth.uid(),'class_review.'||lower(p_decision),p_id);
  select * into task from public.class_tasks where id=item.task_id;
  insert into public.notifications(recipient_id,title,href)
    select a.user_id,task.title||case when p_decision='ACCEPTED' then ': 접수 확정' else ': 보완 요청' end,'/class-tasks/'||item.task_id from public.class_officer_assignments a join public.profiles p on p.id=a.user_id join public.user_roles r on r.user_id=p.id where a.class_id=item.class_id and a.active and p.status='ACTIVE' and r.role_code='CLASS_OFFICER';
  return item;
end $$;

create function public.review_post(p_id uuid,p_decision text,p_reason text default null) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.posts; begin
  if public.current_level()<3 then raise exception 'REVIEWER_REQUIRED'; end if;
  select * into item from public.posts where id=p_id for update;
  if not found or item.author_id=auth.uid() then raise exception 'OTHER_REVIEWER_REQUIRED'; end if;
  if p_decision not in ('APPROVED','REJECTED','HIDDEN') or p_decision is null then raise exception 'INVALID_DECISION'; end if;
  if item.status<>'PENDING' and public.current_level()<4 then raise exception 'EXECUTIVE_REQUIRED'; end if;
  if p_decision='REJECTED' and char_length(btrim(coalesce(p_reason,'')))<2 then raise exception 'REASON_REQUIRED'; end if;
  update public.posts set status=p_decision where id=p_id;
  insert into public.post_reviews(post_id,reviewer_id,decision,reason) values(p_id,auth.uid(),p_decision,p_reason);
  insert into public.audit_logs(actor_id,action,resource_id) values(auth.uid(),'post.'||lower(p_decision),p_id);
  if item.author_id is not null then insert into public.notifications(recipient_id,title,href) values(item.author_id,'게시글 검토 결과가 등록되었습니다.','/posts/'||p_id); end if;
end $$;

create function public.approve_membership(p_request uuid,p_verified boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.membership_requests; begin
  if public.current_level()<>5 then raise exception 'TEACHER_REQUIRED'; end if;
  if p_verified is distinct from true then raise exception 'SCHOOL_VERIFICATION_REQUIRED'; end if;
  select * into item from public.membership_requests where id=p_request for update;
  if not found or item.status<>'PENDING' then raise exception 'NO_PENDING_REQUEST'; end if;
  update public.membership_requests set status='APPROVED',verification_status='VERIFIED',reviewed_by=auth.uid(),reviewed_at=now() where id=p_request;
  update public.profiles set status='ACTIVE',class_id=item.class_id where id=item.user_id;
  insert into public.user_roles(user_id,role_code,granted_by) values(item.user_id,'STUDENT',auth.uid()) on conflict(user_id) do update set role_code='STUDENT',granted_by=auth.uid();
  insert into public.audit_logs(actor_id,action,resource_id) values(auth.uid(),'member.approve',item.user_id);
  insert into public.notifications(recipient_id,title,href) values(item.user_id,'회원가입이 승인되었습니다.','/mypage');
end $$;

create function public.set_member_role(p_user uuid,p_role text,p_class uuid default null,p_position text default null) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_role text; begin
  if public.current_level()<>5 then raise exception 'TEACHER_REQUIRED'; end if;
  if p_role is null or not exists(select 1 from public.roles where code=p_role and level<=4) then raise exception 'INVALID_ROLE'; end if;
  perform 1 from public.profiles where id=p_user and status='ACTIVE' for update;
  if not found then raise exception 'ACTIVE_MEMBER_REQUIRED'; end if;
  select role_code into old_role from public.user_roles where user_id=p_user;
  if old_role='SUPERVISING_TEACHER' then raise exception 'TEACHER_BOOTSTRAP_ONLY'; end if;
  if p_role='CLASS_OFFICER' then
    if p_class is null or p_position is null or p_position not in ('CLASS_PRESIDENT','CLASS_VICE_PRESIDENT') then raise exception 'CLASS_AND_POSITION_REQUIRED'; end if;
    update public.profiles set class_id=p_class where id=p_user;
    insert into public.class_officer_assignments(user_id,class_id,position) values(p_user,p_class,p_position) on conflict(user_id) do update set class_id=p_class,position=p_position,active=true;
  else delete from public.class_officer_assignments where user_id=p_user;
  end if;
  insert into public.user_roles(user_id,role_code,granted_by) values(p_user,p_role,auth.uid()) on conflict(user_id) do update set role_code=p_role,granted_by=auth.uid();
  insert into public.audit_logs(actor_id,action,resource_id,details) values(auth.uid(),'member.role_change',p_user,jsonb_build_object('from',old_role,'to',p_role));
end $$;

-- The Auth user is verified by Supabase; signup metadata never controls role or ACTIVE status.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'가입 신청자'),30));
  insert into public.user_roles(user_id,role_code) values(new.id,'STUDENT');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Only named, validated entry points are callable by authenticated clients.
revoke all on function public.current_level(), public.manages_task(uuid), public.represents_class(uuid), public.reads_suggestion(uuid), public.touch_updated_at(), public.validate_task_answers(uuid,jsonb), public.submit_class_task(uuid,jsonb,int,boolean), public.review_class_submission(uuid,int,text,text), public.review_post(uuid,text,text), public.approve_membership(uuid,boolean), public.set_member_role(uuid,text,uuid,text), public.handle_new_user() from public,anon,authenticated;
grant execute on function public.current_level(), public.manages_task(uuid), public.represents_class(uuid), public.reads_suggestion(uuid), public.submit_class_task(uuid,jsonb,int,boolean), public.review_class_submission(uuid,int,text,text), public.review_post(uuid,text,text), public.approve_membership(uuid,boolean), public.set_member_role(uuid,text,uuid,text) to authenticated;

-- Writes for community drafts are narrowly scoped. Status and pins cannot be escalated.
grant insert(board_id,author_id,title,content,status) on public.posts to authenticated;
create policy posts_create on public.posts for insert to authenticated with check (
  public.current_level()>0 and author_id=auth.uid() and status in ('DRAFT','PENDING') and
  exists(select 1 from public.boards b where b.id=board_id and (not b.official or public.current_level()>=4))
);
grant insert(author_id,title,category,content) on public.suggestions to authenticated;
create policy suggestions_create on public.suggestions for insert to authenticated with check(public.current_level()>0 and author_id=auth.uid() and status='RECEIVED');
grant insert(user_id,class_id,student_number) on public.membership_requests to authenticated;
create policy membership_create on public.membership_requests for insert to authenticated with check(user_id=auth.uid() and status='PENDING' and verification_status='UNVERIFIED' and exists(select 1 from public.profiles where id=auth.uid() and status='PENDING'));
grant update(read_at) on public.notifications to authenticated;
create policy notification_mark_read on public.notifications for update to authenticated using (recipient_id=auth.uid() and public.current_level()>0) with check(recipient_id=auth.uid());

-- Other feature tables remain read-only foundations until their server flows are reviewed.
-- Storage intentionally has no public bucket or broad access policy. Implement validated
-- private upload/signed-download routes before enabling attachments.
commit;
