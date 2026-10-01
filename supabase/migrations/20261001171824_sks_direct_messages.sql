-- Direct messages are scoped to two verified, currently authorized accounts.
create function sks_private.dm_access(p_channel text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare a uuid;b uuid;begin
if auth.uid() is null or sks_private.current_role() is null or p_channel is null or p_channel !~ '^dm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
a:=split_part(p_channel,':',2)::uuid;b:=split_part(p_channel,':',3)::uuid;
if a>=b or auth.uid() not in (a,b) then return false;end if;
return (select count(distinct usr.id)=2 from auth.users usr join sks_private.access_list x on x.email=lower(usr.email) left join public.sks_members m on m.id=x.member_id where usr.id in (a,b) and usr.email_confirmed_at is not null and x.active and (x.role='manager' or m.active));end $$;
revoke all on function sks_private.dm_access(text) from public,anon,authenticated;
grant execute on function sks_private.dm_access(text) to authenticated;
create or replace function sks_private.chat_access(p_channel text) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare r text:=sks_private.current_role();tid bigint;begin
if auth.uid() is null or r is null then return false;end if;
if p_channel='team' then return true;end if;
if p_channel like 'dm:%' then return sks_private.dm_access(p_channel);end if;
if p_channel !~ '^task:[1-9][0-9]{0,17}$' then return false;end if;
tid:=split_part(p_channel,':',2)::bigint;
return exists(select 1 from public.sks_tasks t where t.id=tid and t.deleted_at is null and (r='manager' or t.assignee=sks_private.current_member() or t.support @> array[sks_private.current_member()]));end $$;
create or replace function sks_private.chat_path_channel(p_path text) returns text language sql immutable security invoker set search_path='' as $$ select case when p_path ~ '^(team|task:[1-9][0-9]{0,17}|dm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|pdf|txt|doc|docx|xls|xlsx|ppt|pptx)$' then split_part(p_path,'/',1) else null end $$;

create function sks_private.chat_people() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
if auth.uid() is null or sks_private.current_role() is null then raise exception 'Sohbet erişimi yok.' using errcode='42501';end if;
return coalesce((select jsonb_agg(to_jsonb(p) order by sort,name) from (
select u.id as user_id,null::integer as member_id,'Pelin Ay'::text as name,'manager'::text as role,true as active,0 as sort from sks_private.access_list a join auth.users u on lower(u.email)=a.email where a.role='manager' and a.active and u.email_confirmed_at is not null
union all
select u.id,m.id,m.name,'student',m.active,1 from public.sks_members m left join sks_private.access_list a on a.member_id=m.id and a.active left join auth.users u on lower(u.email)=a.email and u.email_confirmed_at is not null and m.active
) p),'[]'::jsonb);end $$;
revoke all on function sks_private.chat_people() from public,anon,authenticated;
grant execute on function sks_private.chat_people() to authenticated;
create function public.sks_chat_people() returns jsonb language sql stable security invoker set search_path='' as $$ select sks_private.chat_people() $$;
revoke all on function public.sks_chat_people() from public,anon,authenticated;
grant execute on function public.sks_chat_people() to authenticated;
create or replace function sks_private.daily_backup() returns void language plpgsql security invoker set search_path='' as $$ begin
insert into sks_private.backups(day,payload) values((now() at time zone 'Europe/Istanbul')::date,jsonb_build_object('format','sks-dijital-kanallar-backup','version',3,'exportedAt',now(),'records',jsonb_build_object('members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.sks_members m),'access',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from sks_private.access_list a),'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.sks_tasks t),'comments',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.sks_comments c),'templates',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.sks_templates t),'activity',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.sks_activity a),'messages',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.sks_messages m where m.channel not like 'dm:%'),'chatFiles',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.sks_chat_files f join public.sks_messages m on m.id=f.message_id where m.channel not like 'dm:%'),'chatReads',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.sks_chat_reads r where r.channel not like 'dm:%'),'notifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from public.sks_notifications n)))) on conflict(day) do nothing;
delete from sks_private.backups where day<(now() at time zone 'Europe/Istanbul')::date-29;
end $$;
