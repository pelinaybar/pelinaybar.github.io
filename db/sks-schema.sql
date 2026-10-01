create schema if not exists sks_private;
revoke all on schema sks_private from public,anon;
grant usage on schema sks_private to authenticated;
create table public.sks_members(id integer primary key check(id between 1 and 6),name text not null check(length(name) between 1 and 120),active boolean not null default false);
create table sks_private.access_list(id integer primary key,member_id integer unique references public.sks_members(id),email text unique not null check(email=lower(email)),role text not null check(role in ('manager','student')),active boolean not null default true,check((role='manager' and member_id is null) or (role='student' and member_id is not null)));
alter table sks_private.access_list enable row level security;
revoke all on sks_private.access_list from public,anon,authenticated;
create table public.sks_tasks(id bigint generated always as identity primary key,title text not null check(length(trim(title)) between 1 and 200),description text not null default '' check(length(description)<=5000),assignee integer not null references public.sks_members(id),support integer[] not null default '{}',category text not null check(category in ('Görsel tasarım','Video ve kurgu','İçerik ve metin','Fotoğraf ve çekim','Yayın hazırlığı','Raporlama')),priority text not null default 'Normal' check(priority in ('Düşük','Normal','Yüksek','Acil')),due date not null,status text not null default 'todo' check(status in ('todo','progress','review','revision','done')),publication text not null default 'unplanned' check(publication in ('unplanned','planned','published')),delivery text not null default '' check(length(delivery)<=2000 and (delivery='' or delivery ~ '^https?://')),created timestamptz not null default now(),updated timestamptz not null default now());
create index sks_tasks_assignee_idx on public.sks_tasks(assignee);
create index sks_tasks_support_idx on public.sks_tasks using gin(support);
create table public.sks_comments(id bigint generated always as identity primary key,task_id bigint not null references public.sks_tasks(id),author_id uuid not null default auth.uid() references auth.users(id),author text not null,body text not null check(length(trim(body)) between 1 and 5000),created timestamptz not null default now());
create index sks_comments_task_idx on public.sks_comments(task_id);
create index sks_comments_author_idx on public.sks_comments(author_id);
alter table public.sks_members enable row level security;
alter table public.sks_tasks enable row level security;
alter table public.sks_comments enable row level security;
-- Only these private helpers may read the protected account-email mappings.
create function sks_private.current_role() returns text language sql stable security definer set search_path='' as $$ select a.role from sks_private.access_list a join auth.users u on lower(u.email)=a.email left join public.sks_members m on m.id=a.member_id where u.id=(select auth.uid()) and u.email_confirmed_at is not null and a.active and (a.role='manager' or m.active) limit 1 $$;
create function sks_private.current_member() returns integer language sql stable security definer set search_path='' as $$ select a.member_id from sks_private.access_list a join auth.users u on lower(u.email)=a.email join public.sks_members m on m.id=a.member_id where u.id=(select auth.uid()) and u.email_confirmed_at is not null and a.active and m.active limit 1 $$;
create function sks_private.student_emails() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin if auth.uid() is null or sks_private.current_role() is distinct from 'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;return coalesce((select jsonb_object_agg(member_id::text,email) from sks_private.access_list where role='student'),'{}'::jsonb);end $$;
create function sks_private.set_student_email(p_id integer,p_email text) returns void language plpgsql security definer set search_path='' as $$ begin if auth.uid() is null or sks_private.current_role() is distinct from 'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;if p_id not between 1 and 6 then raise exception 'Geçersiz öğrenci.';end if;if trim(p_email)='' then update sks_private.access_list set active=false where member_id=p_id;return;end if;if length(p_email)>250 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Geçerli bir e-posta adresi girin.';end if;insert into sks_private.access_list(id,member_id,email,role,active) values(p_id,p_id,lower(trim(p_email)),'student',true) on conflict(id) do update set email=excluded.email,active=true;end $$;
revoke all on all functions in schema sks_private from public,anon,authenticated;
grant execute on function sks_private.current_role(),sks_private.current_member(),sks_private.student_emails(),sks_private.set_student_email(integer,text) to authenticated;
create policy members_read on public.sks_members for select to authenticated using((select sks_private.current_role()) is not null);
create policy members_update on public.sks_members for update to authenticated using((select sks_private.current_role())='manager') with check((select sks_private.current_role())='manager');
create policy tasks_read on public.sks_tasks for select to authenticated using((select sks_private.current_role())='manager' or assignee=(select sks_private.current_member()) or support @> array[(select sks_private.current_member())]);
create policy tasks_insert on public.sks_tasks for insert to authenticated with check((select sks_private.current_role())='manager');
create policy tasks_update on public.sks_tasks for update to authenticated using((select sks_private.current_role())='manager' or assignee=(select sks_private.current_member()) or support @> array[(select sks_private.current_member())]) with check((select sks_private.current_role())='manager' or assignee=(select sks_private.current_member()) or support @> array[(select sks_private.current_member())]);
create policy comments_read on public.sks_comments for select to authenticated using(exists(select 1 from public.sks_tasks t where t.id=task_id));
create policy comments_insert on public.sks_comments for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.sks_tasks t where t.id=task_id));
revoke all on public.sks_members,public.sks_tasks,public.sks_comments from public,anon,authenticated;
grant select,update on public.sks_members to authenticated;
grant select,insert,update on public.sks_tasks to authenticated;
grant select,insert on public.sks_comments to authenticated;
grant usage,select on sequence public.sks_tasks_id_seq,public.sks_comments_id_seq to authenticated;
create function sks_private.validate_task() returns trigger language plpgsql security invoker set search_path='' as $$ declare r text:=sks_private.current_role();begin if auth.uid() is null then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;if tg_op='UPDATE' and r is distinct from 'manager' then if (to_jsonb(new)-'status'-'delivery'-'updated') is distinct from (to_jsonb(old)-'status'-'delivery'-'updated') then raise exception 'Görev bilgilerini yalnızca birim sorumlusu değiştirebilir.' using errcode='42501';end if;if old.status not in ('todo','progress','revision') or new.status not in ('todo','progress','review','revision') or (new.status<>old.status and new.status not in ('progress','review')) then raise exception 'Bu aşamayı yalnızca birim sorumlusu değiştirebilir.' using errcode='42501';end if;end if;if tg_op='INSERT' and r is distinct from 'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;if not exists(select 1 from public.sks_members where id=new.assignee and active) or exists(select 1 from unnest(new.support) s where s=new.assignee or not exists(select 1 from public.sks_members where id=s and active)) then raise exception 'Aktif bir sorumlu ve destek ekibi seçin.';end if;new.updated=now();if tg_op='INSERT' then new.created=now();new.status='todo';new.publication='unplanned';end if;return new;end $$;
create trigger sks_task_guard before insert or update on public.sks_tasks for each row execute function sks_private.validate_task();
create function sks_private.stamp_comment() returns trigger language plpgsql security invoker set search_path='' as $$ begin if auth.uid() is null or sks_private.current_role() is null then raise exception 'Giriş yetkisi gerekiyor.' using errcode='42501';end if;new.author_id=auth.uid();new.author=case when sks_private.current_role()='manager' then 'Pelin Ay' else (select name from public.sks_members where id=sks_private.current_member()) end;new.created=now();return new;end $$;
create trigger sks_comment_guard before insert on public.sks_comments for each row execute function sks_private.stamp_comment();
revoke all on function sks_private.validate_task(),sks_private.stamp_comment() from public,anon,authenticated;
create function public.sks_state() returns jsonb language plpgsql stable security invoker set search_path='' as $$ declare r text:=sks_private.current_role();mid integer:=sks_private.current_member();begin if auth.uid() is null or r is null then raise exception 'Bu hesap için pano erişimi tanımlanmamış veya e-posta doğrulanmamış.' using errcode='42501';end if;return jsonb_build_object('viewer',jsonb_build_object('manager',r='manager','name',case when r='manager' then 'Pelin Ay' else (select name from public.sks_members where id=mid) end,'memberId',mid),'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.sks_members m),'[]'::jsonb),'emails',case when r='manager' then sks_private.student_emails() else '{}'::jsonb end,'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc) from public.sks_tasks t),'[]'::jsonb),'comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.sks_comments c),'[]'::jsonb));end $$;
create function public.sks_apply(p_action text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ declare r text:=sks_private.current_role();tid bigint;sid integer;t jsonb;sup integer[];current_status text;note text;affected integer;begin if auth.uid() is null or r is null then raise exception 'Giriş yetkisi gerekiyor.' using errcode='42501';end if;
if p_action='member' then if r<>'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;sid=(p_data->>'id')::integer;update public.sks_members set name=trim(p_data->>'name'),active=(p_data->>'active')::boolean where id=sid;get diagnostics affected=row_count;if affected=0 then raise exception 'Öğrenci bulunamadı.';end if;perform sks_private.set_student_email(sid,coalesce(p_data->>'email',''));
elsif p_action in ('create','edit') then if r<>'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;t=p_data->'task';sup=array(select distinct value::integer from jsonb_array_elements_text(coalesce(t->'support','[]'::jsonb)));if p_action='create' then insert into public.sks_tasks(title,description,assignee,support,category,priority,due) values(trim(t->>'title'),coalesce(t->>'description',''),(t->>'assignee')::integer,sup,t->>'category',t->>'priority',(t->>'due')::date);else update public.sks_tasks set title=trim(t->>'title'),description=coalesce(t->>'description',''),assignee=(t->>'assignee')::integer,support=sup,category=t->>'category',priority=t->>'priority',due=(t->>'due')::date where id=(p_data->>'id')::bigint;get diagnostics affected=row_count;if affected=0 then raise exception 'Görev bulunamadı.';end if;end if;
else tid=(p_data->>'id')::bigint;select status into current_status from public.sks_tasks where id=tid for update;if not found then raise exception 'Görev bulunamadı veya yetkiniz yok.' using errcode='42501';end if;
if p_action='status' then note=trim(coalesce(p_data->>'note',''));if p_data->>'status'='revision' and note='' then raise exception 'Revizyon açıklaması yazın.';end if;update public.sks_tasks set status=p_data->>'status' where id=tid;insert into public.sks_comments(task_id,author,body) values(tid,'',case when p_data->>'status'='revision' then 'Revizyon: '||note else 'Durum güncellendi: '||case p_data->>'status' when 'todo' then 'Yapılacak' when 'progress' then 'Devam Ediyor' when 'review' then 'Onay Bekliyor' when 'done' then 'Tamamlandı' else 'Revizyon Gerekli' end end);
elsif p_action='comment' then insert into public.sks_comments(task_id,author,body) values(tid,'',trim(p_data->>'body'));
elsif p_action='delivery' then update public.sks_tasks set delivery=trim(coalesce(p_data->>'delivery','')) where id=tid;
elsif p_action='publication' then if r<>'manager' then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;update public.sks_tasks set publication=p_data->>'publication' where id=tid;
else raise exception 'Geçersiz işlem.';end if;end if;return public.sks_state();end $$;
revoke all on function public.sks_state(),public.sks_apply(text,jsonb) from public,anon,authenticated;
grant execute on function public.sks_state(),public.sks_apply(text,jsonb) to authenticated;
create function sks_private.enforce_registration_allowlist()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Signup has no auth.uid yet. Only this auth.users trigger can invoke the
  -- private function; API roles have no execute permission or schema access.
  if new.email is null or not exists (
    select 1 from sks_private.access_list a
    left join public.sks_members m on m.id=a.member_id
    where a.email=lower(trim(new.email)) and a.active
      and (a.role='manager' or m.active)
  ) then
    raise exception 'Bu e-posta için kayıt izni yok.' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function sks_private.enforce_registration_allowlist() from public,anon,authenticated,supabase_auth_admin;
create trigger sks_registration_allowlist
before insert or update of email on auth.users
for each row execute function sks_private.enforce_registration_allowlist();
