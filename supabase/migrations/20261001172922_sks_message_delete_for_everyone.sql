-- Empty deletion tombstones allow Realtime updates without exposing removed content.
alter policy chat_read on public.sks_messages using(sks_private.chat_access(channel));
alter policy chat_moderate on public.sks_messages using(sks_private.chat_access(channel) and (author_id=(select auth.uid()) or (select sks_private.current_role())='manager')) with check(sks_private.chat_access(channel) and (author_id=(select auth.uid()) or (select sks_private.current_role())='manager'));
alter policy chat_files_read on public.sks_chat_files using(exists(select 1 from public.sks_messages m where m.id=message_id and m.deleted_at is null));
create or replace function sks_private.chat_stamp() returns trigger language plpgsql security invoker set search_path='' as $$ begin
if not sks_private.chat_access(new.channel) then raise exception 'Sohbet erişimi yok.' using errcode='42501';end if;
if tg_op='INSERT' then
new.author_id=auth.uid();new.author=case when sks_private.current_role()='manager' then 'Pelin Ay' else (select name from public.sks_members where id=sks_private.current_member()) end;new.created=now();new.deleted_at=null;
if cardinality(new.mentions)>6 or exists(select 1 from unnest(new.mentions) n where not exists(select 1 from public.sks_members where id=n and active)) then raise exception 'Etiketlenen öğrenci geçersiz.';end if;
else
if (sks_private.current_role() is distinct from 'manager' and old.author_id is distinct from auth.uid()) or (to_jsonb(new)-'deleted_at') is distinct from (to_jsonb(old)-'deleted_at') then raise exception 'Mesajı yalnızca birim sorumlusu kaldırabilir.' using errcode='42501';end if;
new.deleted_at=now();new.body='';new.mentions='{}';end if;return new;end $$;
create or replace function sks_private.chat_object_access(p_path text,p_delete boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare c text:=sks_private.chat_path_channel(p_path);m public.sks_messages;linked boolean;begin
if auth.uid() is null or not coalesce(sks_private.chat_access(c),false) then return false;end if;
select msg.* into m from public.sks_chat_files f join public.sks_messages msg on msg.id=f.message_id where f.path=p_path;linked:=found;
if p_delete then return sks_private.current_role()='manager' or (linked and m.author_id=auth.uid() and m.deleted_at is not null) or (not linked and split_part(p_path,'/',2)=auth.uid()::text);end if;
if linked then return m.channel=c and (m.deleted_at is null or m.author_id=auth.uid() or sks_private.current_role()='manager');end if;
return split_part(p_path,'/',2)=auth.uid()::text;end $$;

create or replace function public.sks_chat_remove(p_id bigint) returns void language plpgsql security invoker set search_path='' as $$ begin
if auth.uid() is null or sks_private.current_role() is null then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
update public.sks_messages set deleted_at=now() where id=p_id and deleted_at is null and (author_id=auth.uid() or sks_private.current_role()='manager');
if not found then raise exception 'Yalnızca kendi mesajınızı silebilirsiniz veya mesaj zaten silinmiş.' using errcode='42501';end if;end $$;
