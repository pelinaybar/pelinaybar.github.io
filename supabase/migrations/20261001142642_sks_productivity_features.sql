-- Additive upgrade: existing tasks, accounts and permission mappings are preserved.
alter table public.sks_tasks add column checklist jsonb not null default '[]', add column shoot_date date, add column publish_date date, add column hours numeric(6,1) not null default 1 check(hours between 0 and 999);
alter table public.sks_tasks add constraint checklist_shape check(jsonb_typeof(checklist)='array' and jsonb_array_length(checklist)<=30);
create table public.sks_templates(id bigint generated always as identity primary key,name text not null check(length(trim(name)) between 1 and 120),title text not null,description text not null default '',category text not null,priority text not null default 'Normal',hours numeric(6,1) not null default 1 check(hours between 0 and 999),items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=30));
create table public.sks_activity(id bigint generated always as identity primary key,task_id bigint references public.sks_tasks(id),actor text not null,action text not null,detail text not null,created timestamptz not null default now());
create index sks_activity_task_idx on public.sks_activity(task_id,id desc);
create table public.sks_notifications(id bigint generated always as identity primary key,task_id bigint not null references public.sks_tasks(id),member_id integer references public.sks_members(id),message text not null,created timestamptz not null default now(),read_at timestamptz,event_key text unique);
create index sks_notifications_member_idx on public.sks_notifications(member_id,id desc);
create table sks_private.backups(day date primary key,created timestamptz not null default now(),payload jsonb not null);
alter table public.sks_templates enable row level security;
alter table public.sks_activity enable row level security;
alter table public.sks_notifications enable row level security;
alter table sks_private.backups enable row level security;
revoke all on public.sks_templates,public.sks_activity,public.sks_notifications,sks_private.backups from public,anon,authenticated;
grant select,insert,update,delete on public.sks_templates to authenticated;
grant select on public.sks_activity,public.sks_notifications to authenticated;
grant update(read_at) on public.sks_notifications to authenticated;
grant usage,select on sequence public.sks_templates_id_seq to authenticated;
create policy templates_read on public.sks_templates for select to authenticated using((select sks_private.current_role()) is not null);
create policy templates_write on public.sks_templates for all to authenticated using((select sks_private.current_role())='manager') with check((select sks_private.current_role())='manager');
create policy activity_read on public.sks_activity for select to authenticated using((select sks_private.current_role())='manager' or exists(select 1 from public.sks_tasks t where t.id=task_id));
create policy notifications_read on public.sks_notifications for select to authenticated using(((member_id is null and (select sks_private.current_role())='manager') or member_id=(select sks_private.current_member())) and exists(select 1 from public.sks_tasks t where t.id=task_id));
create policy notifications_update on public.sks_notifications for update to authenticated using(((member_id is null and (select sks_private.current_role())='manager') or member_id=(select sks_private.current_member())) and exists(select 1 from public.sks_tasks t where t.id=task_id)) with check(((member_id is null and (select sks_private.current_role())='manager') or member_id=(select sks_private.current_member())) and exists(select 1 from public.sks_tasks t where t.id=task_id));
-- Structural validation prevents students changing checklist labels or task fields.
create or replace function sks_private.validate_task() returns trigger language plpgsql security invoker set search_path='' as $$
declare r text:=sks_private.current_role();begin
if auth.uid() is null then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
if jsonb_typeof(new.checklist)<>'array' or jsonb_array_length(new.checklist)>30 or exists(select 1 from jsonb_array_elements(new.checklist) v where jsonb_typeof(v)<>'object' or jsonb_typeof(v->'label') is distinct from 'string' or length(trim(v->>'label')) not between 1 and 200 or jsonb_typeof(v->'done') is distinct from 'boolean' or v-'label'-'done'<>'{}'::jsonb) then raise exception 'Kontrol listesi geçersiz.';end if;
if tg_op='UPDATE' and r is distinct from 'manager' then
if (to_jsonb(new)-'status'-'delivery'-'updated'-'checklist') is distinct from (to_jsonb(old)-'status'-'delivery'-'updated'-'checklist') or (select jsonb_agg(v->'label' order by n) from jsonb_array_elements(new.checklist) with ordinality x(v,n)) is distinct from (select jsonb_agg(v->'label' order by n) from jsonb_array_elements(old.checklist) with ordinality x(v,n)) then raise exception 'Görev bilgilerini yalnızca birim sorumlusu değiştirebilir.' using errcode='42501';end if;
if old.status not in ('todo','progress','revision') or new.status not in ('todo','progress','review','revision') or (new.status<>old.status and new.status not in ('progress','review')) then raise exception 'Bu aşamayı yalnızca birim sorumlusu değiştirebilir.' using errcode='42501';end if;end if;
if tg_op='INSERT' and r is distinct from 'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;
if not exists(select 1 from public.sks_members where id=new.assignee and active) or exists(select 1 from unnest(new.support) s where s=new.assignee or not exists(select 1 from public.sks_members where id=s and active)) then raise exception 'Aktif bir sorumlu ve destek ekibi seçin.';end if;
if new.status in ('review','done') and exists(select 1 from jsonb_array_elements(new.checklist) v where not (v->>'done')::boolean) then raise exception 'Onaya sunmadan önce kontrol listesini tamamlayın.';end if;
new.updated=now();if tg_op='INSERT' then new.created=now();new.status='todo';new.publication='unplanned';end if;return new;end $$;
-- Internal trigger has narrow privileges; API roles cannot create audit entries.
create function sks_private.record_event() returns trigger language plpgsql security definer set search_path='' as $$
declare tid bigint;actor_name text;message_text text;event_name text;target public.sks_tasks;actor_member integer;begin
if auth.uid() is null or sks_private.current_role() is null then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
actor_member:=sks_private.current_member();actor_name:=case when sks_private.current_role()='manager' then 'Pelin Ay' else (select name from public.sks_members where id=actor_member) end;
if tg_table_name='sks_tasks' then
 target:=new;tid:=new.id;
 if tg_op='INSERT' then event_name:='created';message_text:='Yeni görev oluşturuldu';
 elsif (to_jsonb(new)-'updated')=(to_jsonb(old)-'updated') then return new;
 elsif new.status<>old.status then event_name:='status';message_text:='Durum: '||case new.status when 'todo' then 'Yapılacak' when 'progress' then 'Devam ediyor' when 'review' then 'Onay bekliyor' when 'revision' then 'Revizyon gerekli' else 'Tamamlandı' end;
 elsif new.checklist<>old.checklist then event_name:='checklist';message_text:='Kontrol listesi güncellendi';
 elsif new.delivery<>old.delivery then event_name:='delivery';message_text:='Teslim bağlantısı güncellendi';
 else event_name:='edited';message_text:='Görev bilgileri güncellendi';end if;
else tid:=new.task_id;select * into target from public.sks_tasks where id=tid;event_name:='comment';message_text:='Yorum eklendi';end if;
insert into public.sks_activity(task_id,actor,action,detail) values(tid,actor_name,event_name,message_text);
if event_name<>'checklist' then
if sks_private.current_role()<>'manager' then insert into public.sks_notifications(task_id,member_id,message) values(tid,null,message_text||': '||target.title);end if;
insert into public.sks_notifications(task_id,member_id,message) select tid,m,message_text||': '||target.title from (select distinct unnest(array[target.assignee]||target.support) m) x where m is distinct from actor_member;
end if;return new;end $$;
revoke all on function sks_private.record_event() from public,anon,authenticated;
create trigger sks_task_events after insert or update on public.sks_tasks for each row execute function sks_private.record_event();
create trigger sks_comment_events after insert on public.sks_comments for each row execute function sks_private.record_event();
create function sks_private.backup_index() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin if auth.uid() is null or sks_private.current_role() is distinct from 'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;return coalesce((select jsonb_agg(jsonb_build_object('day',day,'created',created,'bytes',octet_length(payload::text)) order by day desc) from sks_private.backups),'[]'::jsonb);end $$;
revoke all on function sks_private.backup_index() from public,anon,authenticated;
grant execute on function sks_private.backup_index() to authenticated;
create function public.sks_dashboard() returns jsonb language plpgsql stable security invoker set search_path='' as $$ declare base jsonb:=public.sks_state();begin return base||jsonb_build_object('templates',coalesce((select jsonb_agg(to_jsonb(t) order by id) from public.sks_templates t),'[]'::jsonb),'activity',coalesce((select jsonb_agg(to_jsonb(a) order by id desc) from (select * from public.sks_activity order by id desc limit 200) a),'[]'::jsonb),'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by id desc) from (select * from public.sks_notifications order by id desc limit 100) n),'[]'::jsonb),'backups',case when sks_private.current_role()='manager' then sks_private.backup_index() else '[]'::jsonb end);end $$;
create function public.sks_features(p_action text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ declare r text:=sks_private.current_role();tid bigint;payload jsonb;items jsonb;begin
if auth.uid() is null or r is null then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
if p_action='read' then update public.sks_notifications set read_at=now() where read_at is null and (p_data->>'id' is null or id=(p_data->>'id')::bigint);
elsif p_action='check' then tid:=(p_data->>'id')::bigint;perform 1 from public.sks_tasks where id=tid for update;if not found then raise exception 'Görev erişimi yok.' using errcode='42501';end if;update public.sks_tasks set checklist=(select coalesce(jsonb_agg(case when n=(p_data->>'index')::integer+1 then jsonb_set(v,'{done}',p_data->'done') else v end order by n),'[]'::jsonb) from jsonb_array_elements(checklist) with ordinality x(v,n)) where id=tid;
elsif p_action='template-delete' then if r<>'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;delete from public.sks_templates where id=(p_data->>'id')::bigint;
elsif p_action='template' then if r<>'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;payload:=p_data->'template';items:=payload->'items';if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>30 or exists(select 1 from jsonb_array_elements(items) v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 200) then raise exception 'Şablon kontrol listesi geçersiz.';end if;if p_data->>'id' is null then insert into public.sks_templates(name,title,description,category,priority,hours,items) values(trim(payload->>'name'),trim(payload->>'title'),payload->>'description',payload->>'category',payload->>'priority',(payload->>'hours')::numeric,items);else update public.sks_templates set name=trim(payload->>'name'),title=trim(payload->>'title'),description=payload->>'description',category=payload->>'category',priority=payload->>'priority',hours=(payload->>'hours')::numeric,items=items where id=(p_data->>'id')::bigint;end if;
elsif p_action='create' or p_action='edit' then if r<>'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;payload:=p_data->'task';if p_action='create' then insert into public.sks_tasks(title,description,assignee,support,category,priority,due,checklist,shoot_date,publish_date,hours) values(trim(payload->>'title'),payload->>'description',(payload->>'assignee')::integer,array(select distinct value::integer from jsonb_array_elements_text(payload->'support')),payload->>'category',payload->>'priority',(payload->>'due')::date,payload->'checklist',nullif(payload->>'shoot_date','')::date,nullif(payload->>'publish_date','')::date,(payload->>'hours')::numeric);else update public.sks_tasks set title=trim(payload->>'title'),description=payload->>'description',assignee=(payload->>'assignee')::integer,support=array(select distinct value::integer from jsonb_array_elements_text(payload->'support')),category=payload->>'category',priority=payload->>'priority',due=(payload->>'due')::date,checklist=payload->'checklist',shoot_date=nullif(payload->>'shoot_date','')::date,publish_date=nullif(payload->>'publish_date','')::date,hours=(payload->>'hours')::numeric where id=(p_data->>'id')::bigint;end if;
else raise exception 'Geçersiz işlem.';end if;return public.sks_dashboard();end $$;
revoke all on function public.sks_dashboard(),public.sks_features(text,jsonb) from public,anon,authenticated;
grant execute on function public.sks_dashboard(),public.sks_features(text,jsonb) to authenticated;
-- Scheduler runs as the database owner; no client can call maintenance routines.
create function sks_private.daily_backup() returns void language plpgsql security invoker set search_path='' as $$ begin
insert into sks_private.backups(day,payload) values((now() at time zone 'Europe/Istanbul')::date,jsonb_build_object('format','sks-dijital-kanallar-backup','version',2,'exportedAt',now(),'records',jsonb_build_object('members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.sks_members m),'access',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from sks_private.access_list a),'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.sks_tasks t),'comments',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.sks_comments c),'templates',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.sks_templates t),'activity',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.sks_activity a)))) on conflict(day) do nothing;
delete from sks_private.backups where day<(now() at time zone 'Europe/Istanbul')::date-30;
end $$;
create function sks_private.due_reminders() returns void language plpgsql security invoker set search_path='' as $$ declare d date:=(now() at time zone 'Europe/Istanbul')::date;begin
insert into public.sks_notifications(task_id,member_id,message,event_key)
select t.id,x.m,case when t.due<d then 'Teslim gecikti: ' else 'Teslim yaklaşıyor: ' end||t.title||' · '||t.due,'due:'||t.id||':'||coalesce(x.m::text,'manager')||':'||t.due||':'||case when t.due<d then 'late' else 'soon' end
from public.sks_tasks t cross join lateral (select distinct unnest(array[null::integer,t.assignee]||t.support) m) x where t.status<>'done' and t.due<=d+2 on conflict(event_key) do nothing;
end $$;
revoke all on function sks_private.daily_backup(),sks_private.due_reminders() from public,anon,authenticated;
create function public.sks_backup(p_day date) returns jsonb language plpgsql security definer set search_path='' as $$ begin if auth.uid() is null or sks_private.current_role() is distinct from 'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;return (select payload from sks_private.backups where day=p_day);end $$;
-- Public RPC is explicitly authenticated and manager-checked; cannot expose snapshots.
revoke all on function public.sks_backup(date) from public,anon,authenticated;
grant execute on function public.sks_backup(date) to authenticated;
insert into public.sks_templates(name,title,description,category,hours,items) values
('Etkinlik duyurusu','Etkinlik duyurusu hazırlığı','Etkinlik adı, tarih, yer ve başvuru bilgisini doğrulayın.','Görsel tasarım',2,'["Etkinlik bilgileri doğrulandı","Metin hazırlandı","Görsel hazırlandı","Son kontrol yapıldı"]'),
('Video üretimi','Etkinlik videosu','Çekim planını hazırlayın; kısa video ve kapak görselini teslim edin.','Video ve kurgu',4,'["Çekim planı hazırlandı","Çekimler tamamlandı","Kurgu ve altyazı tamamlandı","Kapak görseli hazırlandı"]'),
('Haftalık bülten','Haftalık etkinlik bülteni','Haftalık etkinlikleri derleyin ve yayın taslağını hazırlayın.','İçerik ve metin',3,'["Etkinlikler derlendi","Tarih ve bağlantılar kontrol edildi","Bülten taslağı hazırlandı","Son okuma yapıldı"]');
create extension if not exists pg_cron;
select cron.schedule('sks-daily-backup','0 3 * * *','select sks_private.daily_backup();');
select cron.schedule('sks-due-reminders','0 * * * *','select sks_private.due_reminders();');
select sks_private.daily_backup();
select sks_private.due_reminders();
