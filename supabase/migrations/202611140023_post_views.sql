begin;

-- Store only the last counted Korean calendar date per member/post. No IP log.
create table app_private.post_view_receipts(
 post_id uuid not null references public.posts(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 last_counted_on date not null,
 primary key(post_id,viewer_id)
);
revoke all on app_private.post_view_receipts from public,anon,authenticated,service_role;

-- Reading a post must not change the displayed content-edit timestamp.
create function app_private.touch_post_edit_time() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if (to_jsonb(new)-'views'-'updated_at') is not distinct from (to_jsonb(old)-'views'-'updated_at') then
  new.updated_at=old.updated_at;
 else new.updated_at=now();end if;
 return new;
end $$;
revoke all on function app_private.touch_post_edit_time() from public,anon,authenticated,service_role;
drop trigger touch_updated_at on public.posts;
create trigger touch_updated_at before update on public.posts for each row execute function app_private.touch_post_edit_time();

create function public.record_post_view(p_post uuid) returns int
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid=auth.uid(); owner_id uuid; total int; today date=(current_timestamp at time zone 'Asia/Seoul')::date;
begin
 if actor is null or public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 select author_id,views into owner_id,total from public.posts where id=p_post and status='APPROVED' for update;
 if not found then raise exception 'PUBLIC_POST_REQUIRED';end if;
 if owner_id=actor then return total;end if;
 insert into app_private.post_view_receipts(post_id,viewer_id,last_counted_on) values(p_post,actor,today)
 on conflict(post_id,viewer_id) do update set last_counted_on=excluded.last_counted_on
 where app_private.post_view_receipts.last_counted_on<excluded.last_counted_on;
 if found then update public.posts set views=views+1 where id=p_post returning views into total;end if;
 return total;
end $$;
revoke all on function public.record_post_view(uuid) from public,anon,authenticated;
grant execute on function public.record_post_view(uuid) to authenticated;

commit;
