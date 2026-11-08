begin;
alter table public.comments add column parent_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column moderation_reasons text[] not null default '{}';
create index comments_parent_idx on public.comments(parent_id);
create table app_private.content_hearts(
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid references public.posts(id) on delete cascade,
 comment_id uuid references public.comments(id) on delete cascade,
 check(num_nonnulls(post_id,comment_id)=1),created_at timestamptz not null default now()
);
create unique index post_heart_unique on app_private.content_hearts(user_id,post_id) where post_id is not null;
create unique index comment_heart_unique on app_private.content_hearts(user_id,comment_id) where comment_id is not null;
revoke all on app_private.content_hearts from public,anon,authenticated,service_role;

create function public.heart_summary(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;begin
 if public.current_level()=0 then return jsonb_build_object('count',0,'liked',false);end if;
 if p_kind='post' then
  if not exists(select 1 from public.posts where id=p_id and status='APPROVED') then return jsonb_build_object('count',0,'liked',false);end if;
  select jsonb_build_object('count',count(*),'liked',coalesce(bool_or(user_id=auth.uid()),false)) into result from app_private.content_hearts where post_id=p_id;
 elsif p_kind='comment' then
  if not exists(select 1 from public.comments c join public.posts p on p.id=c.post_id where c.id=p_id and c.status='APPROVED' and p.status='APPROVED') then return jsonb_build_object('count',0,'liked',false);end if;
  select jsonb_build_object('count',count(*),'liked',coalesce(bool_or(user_id=auth.uid()),false)) into result from app_private.content_hearts where comment_id=p_id;
 else raise exception 'INVALID_TARGET';end if;
 return result;
end $$;
create function public.toggle_heart(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_kind||':'||p_id::text,12));
 if p_kind='post' then
  if not exists(select 1 from public.posts where id=p_id and status='APPROVED') then raise exception 'PUBLIC_POST_REQUIRED';end if;
  if exists(select 1 from app_private.content_hearts where user_id=auth.uid() and post_id=p_id) then delete from app_private.content_hearts where user_id=auth.uid() and post_id=p_id;
  else insert into app_private.content_hearts(user_id,post_id) values(auth.uid(),p_id);end if;
 elsif p_kind='comment' then
  if not exists(select 1 from public.comments c join public.posts p on p.id=c.post_id where c.id=p_id and c.status='APPROVED' and p.status='APPROVED') then raise exception 'PUBLIC_COMMENT_REQUIRED';end if;
  if exists(select 1 from app_private.content_hearts where user_id=auth.uid() and comment_id=p_id) then delete from app_private.content_hearts where user_id=auth.uid() and comment_id=p_id;
  else insert into app_private.content_hearts(user_id,comment_id) values(auth.uid(),p_id);end if;
 else raise exception 'INVALID_TARGET';end if;
 return public.heart_summary(p_kind,p_id);
end $$;
create function public.store_moderated_comment(p_user uuid,p_post uuid,p_content text,p_parent uuid,p_status text,p_reasons text[],p_ai_verified boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid=gen_random_uuid();begin
 if not exists(select 1 from public.profiles where id=p_user and status='ACTIVE' and not credentials_pending) then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if not exists(select 1 from public.posts where id=p_post and status='APPROVED') then raise exception 'PUBLIC_POST_REQUIRED';end if;
 if p_parent is not null and not exists(select 1 from public.comments where id=p_parent and post_id=p_post and parent_id is null and status='APPROVED') then raise exception 'INVALID_REPLY_TARGET';end if;
 if p_status is null or p_status not in ('PENDING','APPROVED') or (p_status='APPROVED' and (not coalesce(p_ai_verified,false) or coalesce(cardinality(p_reasons),0)>0)) then raise exception 'AI_OR_HUMAN_APPROVAL_REQUIRED';end if;
 insert into public.comments(id,post_id,author_id,content,parent_id,status,moderation_reasons) values(result,p_post,p_user,btrim(p_content),p_parent,p_status,p_reasons);
 insert into public.notifications(recipient_id,title,href) select author_id,'내 글에 댓글이 등록되었습니다.','/posts/'||p_post from public.posts where id=p_post and author_id is not null and author_id<>p_user and p_status='APPROVED';
 return result;
end $$;
revoke all on function public.heart_summary(text,uuid),public.toggle_heart(text,uuid),public.store_moderated_comment(uuid,uuid,text,uuid,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.heart_summary(text,uuid),public.toggle_heart(text,uuid) to authenticated;
grant execute on function public.store_moderated_comment(uuid,uuid,text,uuid,text,text[],boolean) to service_role;
commit;
