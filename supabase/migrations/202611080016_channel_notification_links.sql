begin;
create or replace function public.send_council_message(p_thread uuid,p_content text) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;owner_id uuid;begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 select member_id into owner_id from app_private.council_threads where id=p_thread and (member_id=auth.uid() or public.is_council_member());if not found then raise exception 'PRIVATE_THREAD_REQUIRED';end if;
 if p_content is null or char_length(btrim(p_content)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,13));
 if (select count(*) from app_private.council_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'RATE_LIMITED';end if;
 insert into app_private.council_messages(thread_id,sender_id,content) values(p_thread,auth.uid(),btrim(p_content)) returning id into result;
 update app_private.council_threads set updated_at=now() where id=p_thread;
 if auth.uid()<>owner_id then insert into public.notifications(recipient_id,title,href) values(owner_id,'학생회 채널에 답변이 도착했습니다.','/council-channel?thread='||p_thread);
 else insert into public.notifications(recipient_id,title,href) select p.id,'학생회 채널에 새 문의가 도착했습니다.','/council-channel?thread='||p_thread from public.profiles p join public.user_roles r on r.user_id=p.id where p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR') and p.id<>auth.uid();end if;
 return result;
end $$;

create or replace function app_private.channel_notice(p_user uuid,p_content text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare thread uuid;begin
 insert into app_private.council_threads(member_id) values(p_user) on conflict(member_id) do update set updated_at=now() returning id into thread;
 insert into app_private.council_messages(thread_id,content,system_message) values(thread,left(p_content,2000),true);
 insert into public.notifications(recipient_id,title,href) values(p_user,'신청·매칭 안내가 학생회 채널에 도착했습니다.','/council-channel?thread='||thread);
 insert into public.notifications(recipient_id,title,href) select p.id,'새 신청·매칭 안내가 학생회 채널에 있습니다.','/council-channel?thread='||thread from public.profiles p join public.user_roles r on r.user_id=p.id where p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR') and p.id<>p_user;
end $$;

commit;
