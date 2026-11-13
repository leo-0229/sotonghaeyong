begin;

create or replace function public.review_post(p_id uuid,p_decision text,p_reason text default null) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.posts; lvl int=public.current_level();begin
 if lvl<3 then raise exception 'REVIEWER_REQUIRED';end if;
 select * into item from public.posts where id=p_id for update;
 if not found or item.author_id=auth.uid() then raise exception 'OTHER_REVIEWER_REQUIRED';end if;
 if p_decision is null or p_decision not in ('APPROVED','REJECTED','HIDDEN') then raise exception 'INVALID_DECISION';end if;
 if item.status<>'PENDING' and not(item.status='REJECTED' and p_decision='APPROVED') and lvl<4 then raise exception 'EXECUTIVE_REQUIRED';end if;
 if p_decision='REJECTED' and char_length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then raise exception 'REASON_REQUIRED';end if;
 update public.posts set status=p_decision where id=p_id;
 insert into public.post_reviews(post_id,reviewer_id,decision,reason,created_at)
 values(p_id,auth.uid(),p_decision,case when p_decision='REJECTED' then btrim(p_reason) else null end,clock_timestamp());
 insert into public.audit_logs(actor_id,action,resource_id) values(auth.uid(),'post.'||lower(p_decision),p_id);
 if item.author_id is not null then
  insert into public.notifications(recipient_id,title,href) values(item.author_id,
   case when p_decision='REJECTED' then '게시글이 반려되었습니다. 글에서 처리자와 사유를 확인해 주세요.'
    when p_decision='APPROVED' and item.status='REJECTED' then '게시글이 재검토 후 공개되었습니다.'
    else '게시글 검토 결과가 등록되었습니다.' end,'/posts/'||p_id);
 end if;
end $$;

-- Rejection metadata belongs to its author and authorized reviewers, not readers.
create function public.post_rejection_info(p_post uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if not exists(select 1 from public.posts where id=p_post and status='REJECTED' and (author_id=auth.uid() or public.current_level()>=3)) then return null;end if;
 return (select jsonb_build_object('reviewer',coalesce(p.display_name,'탈퇴한 운영진'),'date',r.created_at,'reason',r.reason)
  from public.post_reviews r left join public.profiles p on p.id=r.reviewer_id
  where r.post_id=p_post and r.decision='REJECTED' order by r.created_at desc,r.id desc limit 1);
end $$;
revoke all on function public.post_rejection_info(uuid) from public,anon,authenticated;
grant execute on function public.post_rejection_info(uuid) to authenticated;

commit;
