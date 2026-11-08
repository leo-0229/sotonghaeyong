begin;
-- Keep the legacy role code for existing references; its current position is ICT director.
update public.roles set label='정보통신부 부장' where code='PR_DIRECTOR';
alter table public.roles add constraint l4_designated_positions_only
 check ((level=4)=(code in ('COUNCIL_EXECUTIVE','PR_DIRECTOR')));
commit;
