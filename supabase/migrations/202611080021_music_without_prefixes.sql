begin;
update public.boards set title='노래 추천' where slug='music';

create function app_private.clear_music_prefix() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.boards where id=new.board_id and slug='music') then new.prefix='';end if;
 return new;
end $$;
revoke all on function app_private.clear_music_prefix() from public,anon,authenticated,service_role;
create trigger posts_music_without_prefix before insert or update of board_id,prefix on public.posts
 for each row execute function app_private.clear_music_prefix();
update public.posts set prefix='' where board_id=(select id from public.boards where slug='music') and prefix<>'';
commit;
