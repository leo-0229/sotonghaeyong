begin;

-- Only this authenticated RPC can delete community content. No direct table grants.
create function public.delete_community_content(p_kind text,p_id uuid,p_reason text default '') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid=auth.uid();lvl int=public.current_level();owner uuid;post uuid;forced boolean;begin
 if actor is null or lvl=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 if p_kind='post' then
  select author_id,id into owner,post from public.posts where id=p_id for update;
 elsif p_kind='comment' then
  select author_id,post_id into owner,post from public.comments where id=p_id for update;
 else raise exception 'INVALID_CONTENT_KIND';end if;
 if not found then raise exception 'CONTENT_NOT_FOUND';end if;
 forced=owner is distinct from actor;
 if forced and lvl<4 then raise exception 'CONTENT_DELETE_PERMISSION_DENIED';end if;
 if p_reason is null or char_length(p_reason)>500 or (forced and char_length(btrim(p_reason))<5) then raise exception 'DELETE_REASON_REQUIRED';end if;
 if p_kind='post' then
  -- Post deletion also removes its comments, hearts, reports and revision bodies.
  delete from public.notifications where href='/posts/'||p_id;
  delete from public.posts where id=p_id;
 else
  -- Keep other people's replies as top-level comments instead of cascading them away.
  update public.comments set parent_id=null where parent_id=p_id;
  delete from public.comments where id=p_id;
 end if;
 insert into public.audit_logs(actor_id,action,resource_id,details)
 values(actor,p_kind||case when forced then '.force_deleted' else '.author_deleted' end,p_id,
  jsonb_build_object('postId',post,'forced',forced,'reason',btrim(p_reason)));
 return jsonb_build_object('kind',p_kind,'postId',post,'forced',forced);
end $$;
revoke all on function public.delete_community_content(text,uuid,text) from public,anon,authenticated;
grant execute on function public.delete_community_content(text,uuid,text) to authenticated;

commit;
