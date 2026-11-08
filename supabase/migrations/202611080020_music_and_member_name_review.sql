begin;
insert into public.boards(slug,title,official,sort_order) values('music','오노추',false,8) on conflict(slug) do nothing;

-- Only the trusted moderation service reads this runtime list. Never embed it in source/Pages.
create function public.moderation_member_names() returns text[] language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(array_agg(distinct btrim(display_name)) filter(where char_length(btrim(display_name))>=2),'{}'::text[]) from public.profiles;
$$;
revoke all on function public.moderation_member_names() from public,anon,authenticated;
grant execute on function public.moderation_member_names() to service_role;
commit;
