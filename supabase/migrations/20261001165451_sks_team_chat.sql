-- Private team/task chat; authorization uses the verified access list.
create function sks_private.chat_access(p_channel text) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare r text:=sks_private.current_role();tid bigint;begin
if auth.uid() is null or r is null then return false;end if;
if p_channel='team' then return true;end if;
if p_channel !~ '^task:[1-9][0-9]{0,17}$' then return false;end if;
tid:=split_part(p_channel,':',2)::bigint;
return exists(select 1 from public.sks_tasks t where t.id=tid and t.deleted_at is null and (r='manager' or t.assignee=sks_private.current_member() or t.support @> array[sks_private.current_member()]));end $$;
revoke all on function sks_private.chat_access(text) from public,anon,authenticated;
grant execute on function sks_private.chat_access(text) to authenticated;
create table public.sks_messages(id bigint generated always as identity primary key,channel text not null,author_id uuid not null references auth.users(id),author text not null,body text not null default '' check(length(body)<=5000),mentions integer[] not null default '{}',created timestamptz not null default now(),deleted_at timestamptz);
create index sks_messages_channel_idx on public.sks_messages(channel,id desc);
create index sks_messages_author_idx on public.sks_messages(author_id);
create table public.sks_chat_files(id bigint generated always as identity primary key,message_id bigint not null references public.sks_messages(id),path text not null unique,name text not null check(length(name) between 1 and 255),mime text not null,size bigint not null check(size between 1 and 20971520));
create index sks_chat_files_message_idx on public.sks_chat_files(message_id);
create table public.sks_chat_reads(user_id uuid not null references auth.users(id),channel text not null,last_id bigint not null default 0,primary key(user_id,channel));
alter table public.sks_messages enable row level security;
alter table public.sks_chat_files enable row level security;
alter table public.sks_chat_reads enable row level security;
revoke all on public.sks_messages,public.sks_chat_files,public.sks_chat_reads from public,anon,authenticated;
grant select,insert on public.sks_messages,public.sks_chat_files to authenticated;
grant update(deleted_at) on public.sks_messages to authenticated;
grant select,insert,update(last_id) on public.sks_chat_reads to authenticated;
grant usage,select on sequence public.sks_messages_id_seq,public.sks_chat_files_id_seq to authenticated;
create policy chat_read on public.sks_messages for select to authenticated using(sks_private.chat_access(channel) and (deleted_at is null or (select sks_private.current_role())='manager'));
create policy chat_insert on public.sks_messages for insert to authenticated with check(sks_private.chat_access(channel) and author_id=(select auth.uid()) and deleted_at is null);
create policy chat_moderate on public.sks_messages for update to authenticated using((select sks_private.current_role())='manager' and sks_private.chat_access(channel)) with check((select sks_private.current_role())='manager' and sks_private.chat_access(channel));
create policy chat_files_read on public.sks_chat_files for select to authenticated using(exists(select 1 from public.sks_messages m where m.id=message_id));
create policy chat_files_insert on public.sks_chat_files for insert to authenticated with check(exists(select 1 from public.sks_messages m where m.id=message_id and m.author_id=(select auth.uid()) and m.deleted_at is null));
create policy chat_reads_select on public.sks_chat_reads for select to authenticated using(user_id=(select auth.uid()) and sks_private.chat_access(channel));
create policy chat_reads_insert on public.sks_chat_reads for insert to authenticated with check(user_id=(select auth.uid()) and sks_private.chat_access(channel));
create policy chat_reads_update on public.sks_chat_reads for update to authenticated using(user_id=(select auth.uid()) and sks_private.chat_access(channel)) with check(user_id=(select auth.uid()) and sks_private.chat_access(channel));
-- Administrative bucket configuration only; file operations use the Storage API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sks-chat','sks-chat',false,20971520,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create function sks_private.chat_path_channel(p_path text) returns text language sql immutable security invoker set search_path='' as $$ select case when p_path ~ '^(team|task:[1-9][0-9]{0,17})/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|pdf|txt|doc|docx|xls|xlsx|ppt|pptx)$' then split_part(p_path,'/',1) else null end $$;
revoke all on function sks_private.chat_path_channel(text) from public,anon,authenticated;
grant execute on function sks_private.chat_path_channel(text) to authenticated;
-- Narrow private lookup is needed to reject removed-file access even when RLS hides its message.
create function sks_private.chat_object_access(p_path text,p_delete boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare c text:=sks_private.chat_path_channel(p_path);m public.sks_messages;linked boolean;begin
if auth.uid() is null or not coalesce(sks_private.chat_access(c),false) then return false;end if;
select msg.* into m from public.sks_chat_files f join public.sks_messages msg on msg.id=f.message_id where f.path=p_path;linked:=found;
if p_delete then return sks_private.current_role()='manager' or (not linked and split_part(p_path,'/',2)=auth.uid()::text);end if;
if linked then return m.deleted_at is null and m.channel=c;end if;
return split_part(p_path,'/',2)=auth.uid()::text;end $$;
revoke all on function sks_private.chat_object_access(text,boolean) from public,anon,authenticated;
grant execute on function sks_private.chat_object_access(text,boolean) to authenticated;
create policy sks_chat_upload on storage.objects for insert to authenticated with check(bucket_id='sks-chat' and split_part(name,'/',2)=(select auth.uid())::text and sks_private.chat_access(sks_private.chat_path_channel(name)));
create policy sks_chat_download on storage.objects for select to authenticated using(bucket_id='sks-chat' and sks_private.chat_object_access(name,false));
create policy sks_chat_cleanup on storage.objects for delete to authenticated using(bucket_id='sks-chat' and sks_private.chat_object_access(name,true));
create function sks_private.chat_stamp() returns trigger language plpgsql security invoker set search_path='' as $$ begin
if not sks_private.chat_access(new.channel) then raise exception 'Sohbet erişimi yok.' using errcode='42501';end if;
if tg_op='INSERT' then
new.author_id=auth.uid();new.author=case when sks_private.current_role()='manager' then 'Pelin Ay' else (select name from public.sks_members where id=sks_private.current_member()) end;new.created=now();new.deleted_at=null;
if cardinality(new.mentions)>6 or exists(select 1 from unnest(new.mentions) n where not exists(select 1 from public.sks_members where id=n and active)) then raise exception 'Etiketlenen öğrenci geçersiz.';end if;
else
if sks_private.current_role() is distinct from 'manager' or (to_jsonb(new)-'deleted_at') is distinct from (to_jsonb(old)-'deleted_at') then raise exception 'Mesajı yalnızca birim sorumlusu kaldırabilir.' using errcode='42501';end if;
new.deleted_at=now();end if;return new;end $$;
revoke all on function sks_private.chat_stamp() from public,anon,authenticated;
create trigger chat_stamp before insert or update on public.sks_messages for each row execute function sks_private.chat_stamp();
create function sks_private.chat_file_validate() returns trigger language plpgsql security invoker set search_path='' as $$ declare m public.sks_messages;o storage.objects;begin
select * into m from public.sks_messages where id=new.message_id;
perform pg_advisory_xact_lock(new.message_id);
if not found or m.author_id<>auth.uid() or m.deleted_at is not null or split_part(new.path,'/',2)<>auth.uid()::text or sks_private.chat_path_channel(new.path) is distinct from m.channel then raise exception 'Dosya erişimi yok.' using errcode='42501';end if;
if (select count(*) from public.sks_chat_files where message_id=m.id)>=5 then raise exception 'Mesaj başına en fazla 5 dosya ekleyin.';end if;
select * into o from storage.objects where bucket_id='sks-chat' and name=new.path;
if not found or (o.metadata->>'size')::bigint is distinct from new.size or o.metadata->>'mimetype' is distinct from new.mime then raise exception 'Yüklenen dosya bilgileri doğrulanamadı.';end if;
return new;end $$;
revoke all on function sks_private.chat_file_validate() from public,anon,authenticated;
create trigger chat_file_validate before insert on public.sks_chat_files for each row execute function sks_private.chat_file_validate();
create function public.sks_chat(p_channel text,p_before bigint default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$ begin
if not sks_private.chat_access(p_channel) then raise exception 'Sohbet erişimi yok.' using errcode='42501';end if;
return jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('files',coalesce((select jsonb_agg(to_jsonb(f) order by f.id) from public.sks_chat_files f where f.message_id=m.id),'[]'::jsonb)) order by m.id) from (select * from public.sks_messages where channel=p_channel and deleted_at is null and (p_before is null or id<p_before) order by id desc limit 50) m),'[]'::jsonb),'unread',coalesce((select jsonb_agg(jsonb_build_object('channel',x.channel,'count',x.n)) from (select m.channel,count(*) n from public.sks_messages m left join public.sks_chat_reads r on r.channel=m.channel and r.user_id=auth.uid() where m.deleted_at is null and m.author_id<>auth.uid() and m.id>coalesce(r.last_id,0) group by m.channel) x),'[]'::jsonb));end $$;
create function public.sks_chat_send(p_channel text,p_body text,p_files jsonb default '[]',p_mentions integer[] default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$ declare mid bigint;f jsonb;begin
if not sks_private.chat_access(p_channel) then raise exception 'Sohbet erişimi yok.' using errcode='42501';end if;
if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)>5 or (length(trim(coalesce(p_body,'')))=0 and jsonb_array_length(p_files)=0) then raise exception 'Mesaj yazın veya dosya seçin. En fazla 5 dosya ekleyebilirsiniz.';end if;
insert into public.sks_messages(channel,author_id,author,body,mentions) values(p_channel,auth.uid(),'',trim(coalesce(p_body,'')),p_mentions) returning id into mid;
for f in select value from jsonb_array_elements(p_files) loop insert into public.sks_chat_files(message_id,path,name,mime,size) values(mid,f->>'path',f->>'name',f->>'mime',(f->>'size')::bigint);end loop;
return public.sks_chat(p_channel);end $$;
create function public.sks_chat_read(p_channel text,p_last bigint) returns void language plpgsql security invoker set search_path='' as $$ begin
if not sks_private.chat_access(p_channel) then raise exception 'Sohbet erişimi yok.' using errcode='42501';end if;
insert into public.sks_chat_reads(user_id,channel,last_id) values(auth.uid(),p_channel,coalesce((select max(id) from public.sks_messages where channel=p_channel and id<=p_last),0)) on conflict(user_id,channel) do update set last_id=greatest(public.sks_chat_reads.last_id,excluded.last_id);end $$;
create function public.sks_chat_remove(p_id bigint) returns void language plpgsql security invoker set search_path='' as $$ begin
if auth.uid() is null or sks_private.current_role() is distinct from 'manager' then raise exception 'Mesajları yalnızca birim sorumlusu kaldırabilir.' using errcode='42501';end if;
update public.sks_messages set deleted_at=now() where id=p_id and deleted_at is null;if not found then raise exception 'Mesaj bulunamadı.';end if;end $$;
revoke all on function public.sks_chat(text,bigint),public.sks_chat_send(text,text,jsonb,integer[]),public.sks_chat_read(text,bigint),public.sks_chat_remove(bigint) from public,anon,authenticated;
grant execute on function public.sks_chat(text,bigint),public.sks_chat_send(text,text,jsonb,integer[]),public.sks_chat_read(text,bigint),public.sks_chat_remove(bigint) to authenticated;
alter publication supabase_realtime add table public.sks_messages;
