-- Manager-only reversible task removal. No hard DELETE privilege is granted.
alter table public.sks_tasks add column deleted_at timestamptz;
alter policy tasks_read on public.sks_tasks using ( (select sks_private.current_role())='manager' or (deleted_at is null and (assignee=(select sks_private.current_member()) or support @> array[(select sks_private.current_member())])));
alter policy tasks_update on public.sks_tasks using ( (select sks_private.current_role())='manager' or (deleted_at is null and (assignee=(select sks_private.current_member()) or support @> array[(select sks_private.current_member())]))) with check ( (select sks_private.current_role())='manager' or (deleted_at is null and (assignee=(select sks_private.current_member()) or support @> array[(select sks_private.current_member())])));
create or replace function public.sks_state() returns jsonb language plpgsql stable security invoker set search_path='' as $$ declare r text:=sks_private.current_role();mid integer:=sks_private.current_member();begin if auth.uid() is null or r is null then raise exception 'Bu hesap için pano erişimi tanımlanmamış veya e-posta doğrulanmamış.' using errcode='42501';end if;return jsonb_build_object('viewer',jsonb_build_object('manager',r='manager','name',case when r='manager' then 'Pelin Ay' else (select name from public.sks_members where id=mid) end,'memberId',mid),'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.sks_members m),'[]'::jsonb),'emails',case when r='manager' then sks_private.student_emails() else '{}'::jsonb end,'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc) from public.sks_tasks t where t.deleted_at is null),'[]'::jsonb),'comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.sks_comments c),'[]'::jsonb));end $$;
create or replace function public.sks_dashboard() returns jsonb language plpgsql stable security invoker set search_path='' as $$ declare base jsonb:=public.sks_state();begin return base||jsonb_build_object('trash',case when sks_private.current_role()='manager' then coalesce((select jsonb_agg(to_jsonb(t) order by deleted_at desc) from public.sks_tasks t where deleted_at is not null),'[]'::jsonb) else '[]'::jsonb end,'templates',coalesce((select jsonb_agg(to_jsonb(t) order by id) from public.sks_templates t),'[]'::jsonb),'activity',coalesce((select jsonb_agg(to_jsonb(a) order by id desc) from (select * from public.sks_activity order by id desc limit 200) a),'[]'::jsonb),'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by id desc) from (select * from public.sks_notifications order by id desc limit 100) n),'[]'::jsonb),'backups',case when sks_private.current_role()='manager' then sks_private.backup_index() else '[]'::jsonb end);end $$;
create or replace function sks_private.record_event() returns trigger language plpgsql security definer set search_path='' as $$
declare tid bigint;actor_name text;message_text text;event_name text;target public.sks_tasks;actor_member integer;begin
if auth.uid() is null or sks_private.current_role() is null then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
actor_member:=sks_private.current_member();actor_name:=case when sks_private.current_role()='manager' then 'Pelin Ay' else (select name from public.sks_members where id=actor_member) end;
if tg_table_name='sks_tasks' then
 target:=new;tid:=new.id;
 if tg_op='INSERT' then event_name:='created';message_text:='Yeni görev oluşturuldu';
 elsif (to_jsonb(new)-'updated')=(to_jsonb(old)-'updated') then return new;
 elsif new.deleted_at is distinct from old.deleted_at then event_name:=case when new.deleted_at is null then 'restored' else 'deleted' end;message_text:=case when new.deleted_at is null then 'Görev geri alındı' else 'Görev silindi' end;
 elsif new.status<>old.status then event_name:='status';message_text:='Durum: '||case new.status when 'todo' then 'Yapılacak' when 'progress' then 'Devam ediyor' when 'review' then 'Onay bekliyor' when 'revision' then 'Revizyon gerekli' else 'Tamamlandı' end;
 elsif new.checklist<>old.checklist then event_name:='checklist';message_text:='Kontrol listesi güncellendi';
 elsif new.delivery<>old.delivery then event_name:='delivery';message_text:='Teslim bağlantısı güncellendi';
 else event_name:='edited';message_text:='Görev bilgileri güncellendi';end if;
else tid:=new.task_id;select * into target from public.sks_tasks where id=tid;event_name:='comment';message_text:='Yorum eklendi';end if;
insert into public.sks_activity(task_id,actor,action,detail) values(tid,actor_name,event_name,message_text);
if event_name not in ('checklist','deleted') then
if sks_private.current_role()<>'manager' then insert into public.sks_notifications(task_id,member_id,message) values(tid,null,message_text||': '||target.title);end if;
insert into public.sks_notifications(task_id,member_id,message) select tid,m,message_text||': '||target.title from (select distinct unnest(array[target.assignee]||target.support) m) x where m is distinct from actor_member;
end if;return new;end $$;

create or replace function sks_private.due_reminders() returns void language plpgsql security invoker set search_path='' as $$ declare d date:=(now() at time zone 'Europe/Istanbul')::date;begin
insert into public.sks_notifications(task_id,member_id,message,event_key)
select t.id,x.m,case when t.due<d then 'Teslim gecikti: ' else 'Teslim yaklaşıyor: ' end||t.title||' · '||t.due,'due:'||t.id||':'||coalesce(x.m::text,'manager')||':'||t.due||':'||case when t.due<d then 'late' else 'soon' end
from public.sks_tasks t cross join lateral (select distinct unnest(array[null::integer,t.assignee]||t.support) m) x where t.deleted_at is null and t.status<>'done' and t.due<=d+2 on conflict(event_key) do nothing;
end $$;

create function public.sks_trash(p_action text,p_id bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
if auth.uid() is null or sks_private.current_role() is distinct from 'manager' then raise exception 'Görevleri yalnızca birim sorumlusu silebilir veya geri alabilir.' using errcode='42501';end if;
if p_action='delete' then update public.sks_tasks set deleted_at=now() where id=p_id and deleted_at is null;
elsif p_action='restore' then update public.sks_tasks set deleted_at=null where id=p_id and deleted_at is not null;
else raise exception 'Geçersiz işlem.';end if;
if not found then raise exception 'Görev bulunamadı veya işlem zaten yapılmış.';end if;
return public.sks_dashboard();end $$;
revoke all on function public.sks_trash(text,bigint) from public,anon,authenticated;
grant execute on function public.sks_trash(text,bigint) to authenticated;
