begin;
create table public.comment_reports(
 id uuid primary key default gen_random_uuid(),
 comment_id uuid not null references public.comments(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 reporter_id uuid references public.profiles(id) on delete set null,
 reason text not null check(char_length(btrim(reason)) between 5 and 1000),
 status text not null default 'OPEN' check(status in ('OPEN','REVIEWED','DISMISSED')),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,created_at timestamptz not null default now(),
 unique(comment_id,reporter_id)
);
alter table public.comment_reports enable row level security;
revoke all on public.comment_reports from public,anon,authenticated;
grant select on public.comment_reports to authenticated;
create policy comment_reports_read on public.comment_reports for select to authenticated
 using(public.current_level()>0 and (reporter_id=auth.uid() or public.current_level()>=3));

create function public.report_comment(p_comment uuid,p_reason text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid=auth.uid();post uuid;owner uuid;result uuid;begin
 if actor is null or public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 5 and 1000 then raise exception 'INVALID_REPORT_REASON';end if;
 select c.post_id,c.author_id into post,owner from public.comments c join public.posts p on p.id=c.post_id
  where c.id=p_comment and c.status='APPROVED' and p.status='APPROVED';
 if not found then raise exception 'PUBLIC_COMMENT_REQUIRED';end if;
 if owner=actor then raise exception 'OWN_COMMENT_REPORT_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,37));
 select id into result from public.comment_reports where comment_id=p_comment and reporter_id=actor;
 if found then return result;end if;
 if (select count(*) from public.comment_reports where reporter_id=actor and created_at>now()-interval '10 minutes')>=10 then raise exception 'REPORT_RATE_LIMITED';end if;
 insert into public.comment_reports(comment_id,post_id,reporter_id,reason) values(p_comment,post,actor,btrim(p_reason)) returning id into result;
 insert into public.audit_logs(actor_id,action,resource_id) values(actor,'comment.reported',p_comment);
 return result;
end $$;

create function public.comment_report_queue() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()<3 then raise exception 'REVIEWER_REQUIRED';end if;
 return coalesce((select jsonb_agg(to_jsonb(rows)) from (
  select r.id,r.comment_id as "commentId",r.post_id as "postId",r.reason,r.created_at as date,
   c.content,c.author_id as "authorId",coalesce(a.display_name,'탈퇴 회원') as author,
   p.title,coalesce(m.display_name,'탈퇴 회원') as reporter
  from public.comment_reports r join public.comments c on c.id=r.comment_id join public.posts p on p.id=r.post_id
  left join public.profiles a on a.id=c.author_id left join public.profiles m on m.id=r.reporter_id
  where r.status='OPEN' order by r.created_at desc limit 100
 ) rows),'[]'::jsonb);
end $$;

create function public.review_comment_report(p_report uuid,p_status text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare recipient uuid;post uuid;begin
 if public.current_level()<3 then raise exception 'REVIEWER_REQUIRED';end if;
 if p_status is null or p_status not in ('REVIEWED','DISMISSED') then raise exception 'INVALID_REPORT_STATUS';end if;
 update public.comment_reports set status=p_status,reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_report and status='OPEN' returning reporter_id,post_id into recipient,post;
 if not found then raise exception 'OPEN_REPORT_REQUIRED';end if;
 if recipient is not null then insert into public.notifications(recipient_id,title,href) values(recipient,'댓글 신고를 운영진이 확인했습니다.','/posts/'||post);end if;
 insert into public.audit_logs(actor_id,action,resource_id,details) values(auth.uid(),'comment_report.reviewed',p_report,jsonb_build_object('status',p_status));
end $$;
revoke all on function public.report_comment(uuid,text),public.comment_report_queue(),public.review_comment_report(uuid,text) from public,anon,authenticated;
grant execute on function public.report_comment(uuid,text),public.comment_report_queue(),public.review_comment_report(uuid,text) to authenticated;
commit;
