begin;
create function public.is_council_member() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$ select public.current_level() between 3 and 4 $$;
revoke all on function public.is_council_member() from public,anon;
grant execute on function public.is_council_member() to authenticated,service_role;
create table app_private.council_threads(id uuid primary key default gen_random_uuid(),member_id uuid not null unique references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table app_private.council_messages(id uuid primary key default gen_random_uuid(),thread_id uuid not null references app_private.council_threads(id) on delete cascade,sender_id uuid references public.profiles(id) on delete set null,content text not null check(char_length(content) between 1 and 2000),system_message boolean not null default false,created_at timestamptz not null default now());
create index council_messages_thread_time on app_private.council_messages(thread_id,created_at);
revoke all on app_private.council_threads,app_private.council_messages from public,anon,authenticated,service_role;
create function public.open_council_thread() returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 insert into app_private.council_threads(member_id) values(auth.uid()) on conflict(member_id) do update set member_id=excluded.member_id returning id into result;return result;
end $$;
create function public.council_thread_list() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'memberId',t.member_id,'name',p.display_name,'classId',public.class_label(p.class_id),'updatedAt',t.updated_at,'lastMessage',(select content from app_private.council_messages where thread_id=t.id order by created_at desc limit 1)) order by t.updated_at desc) from app_private.council_threads t join public.profiles p on p.id=t.member_id where t.member_id=auth.uid() or public.is_council_member()),'[]');
end $$;
create function public.council_message_list(p_thread uuid,p_before timestamptz default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.current_level()=0 or not exists(select 1 from app_private.council_threads where id=p_thread and (member_id=auth.uid() or public.is_council_member())) then raise exception 'PRIVATE_THREAD_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'senderId',m.sender_id,'senderName',coalesce(p.display_name,'안내'),'content',m.content,'system',m.system_message,'date',m.created_at) order by m.created_at) from (select * from app_private.council_messages where thread_id=p_thread and (p_before is null or created_at<p_before) order by created_at desc limit 100) m left join public.profiles p on p.id=m.sender_id),'[]');
end $$;
create function public.send_council_message(p_thread uuid,p_content text) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;owner_id uuid;begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 select member_id into owner_id from app_private.council_threads where id=p_thread and (member_id=auth.uid() or public.is_council_member());if not found then raise exception 'PRIVATE_THREAD_REQUIRED';end if;
 if p_content is null or char_length(btrim(p_content)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,13));
 if (select count(*) from app_private.council_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'RATE_LIMITED';end if;
 insert into app_private.council_messages(thread_id,sender_id,content) values(p_thread,auth.uid(),btrim(p_content)) returning id into result;
 update app_private.council_threads set updated_at=now() where id=p_thread;
 if auth.uid()<>owner_id then insert into public.notifications(recipient_id,title,href) values(owner_id,'학생회 채널에 답변이 도착했습니다.','/council-channel');
 else insert into public.notifications(recipient_id,title,href) select p.id,'학생회 채널에 새 문의가 도착했습니다.','/council-channel' from public.profiles p join public.user_roles r on r.user_id=p.id where p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR') and p.id<>auth.uid();end if;
 return result;
end $$;
revoke all on function public.open_council_thread(),public.council_thread_list(),public.council_message_list(uuid,timestamptz),public.send_council_message(uuid,text) from public,anon;
grant execute on function public.open_council_thread(),public.council_thread_list(),public.council_message_list(uuid,timestamptz),public.send_council_message(uuid,text) to authenticated;

create function app_private.channel_notice(p_user uuid,p_content text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare thread uuid;begin
 insert into app_private.council_threads(member_id) values(p_user) on conflict(member_id) do update set updated_at=now() returning id into thread;
 insert into app_private.council_messages(thread_id,content,system_message) values(thread,left(p_content,2000),true);
 insert into public.notifications(recipient_id,title,href) values(p_user,'신청·매칭 안내가 학생회 채널에 도착했습니다.','/council-channel');
 insert into public.notifications(recipient_id,title,href) select p.id,'새 신청·매칭 안내가 학생회 채널에 있습니다.','/council-channel' from public.profiles p join public.user_roles r on r.user_id=p.id where p.status='ACTIVE' and not p.credentials_pending and r.role_code in ('COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR') and p.id<>p_user;
end $$;
revoke all on function app_private.channel_notice(uuid,text) from public,anon,authenticated,service_role;
create function app_private.channel_application_notice() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare event_title text;begin
 if tg_table_name='event_applications' then
  select title into event_title from public.school_events where id=new.event_id;
  if tg_op='INSERT' or new.status is distinct from old.status then perform app_private.channel_notice(new.user_id,'행사 ['||coalesce(event_title,'학교 행사')||'] 신청 상태: '||case when new.status='APPLIED' then '신청 완료' else '신청 취소' end||'. 문의는 이 채널에 남겨 주세요.');end if;
 else
  if tg_op='INSERT' then perform app_private.channel_notice(new.user_id,'학교생활 '||new.kind||' 신청이 접수되었습니다. 학생회에서 매칭 후 안내합니다.');
  elsif new.status='매칭 완료' and new.partner_id is distinct from old.partner_id then perform app_private.channel_notice(new.user_id,'학교생활 멘토·멘티가 매칭되었습니다. 멘토·멘티 화면에서 상대를 확인하고 서로 동의하면 전화번호를 교환할 수 있습니다.');end if;
 end if;return new;
end $$;
revoke all on function app_private.channel_application_notice() from public,anon,authenticated,service_role;
create trigger channel_event_application after insert or update of status on public.event_applications for each row execute function app_private.channel_application_notice();
create trigger channel_mentoring_application after insert or update of status,partner_id on public.school_life_mentoring for each row execute function app_private.channel_application_notice();

create table app_private.mentoring_contact_shares(user_id uuid primary key references public.profiles(id) on delete cascade,partner_id uuid not null references public.profiles(id) on delete cascade,sealed_phone text not null check(octet_length(sealed_phone) between 20 and 8192),consented_at timestamptz not null default now());
revoke all on app_private.mentoring_contact_shares from public,anon,authenticated,service_role;
create function app_private.mentoring_partner(p_user uuid) returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select a.partner_id from public.school_life_mentoring a join public.school_life_mentoring b on b.user_id=a.partner_id and b.partner_id=a.user_id join public.profiles pa on pa.id=a.user_id join public.profiles pb on pb.id=b.user_id where a.user_id=p_user and a.status='매칭 완료' and b.status='매칭 완료' and pa.status='ACTIVE' and pb.status='ACTIVE' and not pa.credentials_pending and not pb.credentials_pending and pa.gender=pb.gender limit 1;
$$;
revoke all on function app_private.mentoring_partner(uuid) from public,anon,authenticated,service_role;
create function public.store_mentoring_contact(p_user uuid,p_partner uuid,p_sealed text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if app_private.mentoring_partner(p_user) is distinct from p_partner or p_partner is null then raise exception 'MATCHED_PARTNER_REQUIRED';end if;
 insert into app_private.mentoring_contact_shares(user_id,partner_id,sealed_phone) values(p_user,p_partner,p_sealed) on conflict(user_id) do update set partner_id=excluded.partner_id,sealed_phone=excluded.sealed_phone,consented_at=now();
 insert into public.notifications(recipient_id,title,href) values(p_partner,'매칭 상대가 연락처 공유에 동의했습니다.','/mentoring');
end $$;
create function public.mentoring_contact_state() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare partner uuid;own_contact text;other_contact text;begin
 if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;
 partner=app_private.mentoring_partner(auth.uid());
 select sealed_phone into own_contact from app_private.mentoring_contact_shares where user_id=auth.uid() and partner_id=partner;
 select sealed_phone into other_contact from app_private.mentoring_contact_shares where user_id=partner and partner_id=auth.uid();
 return jsonb_build_object('partnerId',partner,'ownShared',own_contact is not null,'partnerShared',other_contact is not null,'ownSealed',own_contact,'partnerSealed',case when own_contact is not null then other_contact else null end);
end $$;
create function public.revoke_mentoring_contact() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin if public.current_level()=0 then raise exception 'ACTIVE_LOGIN_REQUIRED';end if;delete from app_private.mentoring_contact_shares where user_id=auth.uid();end $$;
create function app_private.clear_mentoring_contacts() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_table_name='profiles' then
  if new.status<>'ACTIVE' then delete from app_private.mentoring_contact_shares where user_id=new.id or partner_id=new.id;end if;
 else
  if new.status<>'매칭 완료' or new.partner_id is distinct from old.partner_id then delete from app_private.mentoring_contact_shares where user_id=new.user_id or partner_id=new.user_id;end if;
 end if;return new;
end $$;
revoke all on function app_private.clear_mentoring_contacts() from public,anon,authenticated,service_role;
create trigger clear_contacts_on_match_change after update of status,partner_id on public.school_life_mentoring for each row execute function app_private.clear_mentoring_contacts();
create trigger clear_contacts_on_suspension after update of status on public.profiles for each row execute function app_private.clear_mentoring_contacts();
revoke all on function public.store_mentoring_contact(uuid,uuid,text),public.mentoring_contact_state(),public.revoke_mentoring_contact() from public,anon,authenticated;
grant execute on function public.store_mentoring_contact(uuid,uuid,text) to service_role;
grant execute on function public.mentoring_contact_state(),public.revoke_mentoring_contact() to authenticated;
commit;
