alter function public.sks_backup(date) set schema sks_private;
revoke all on function sks_private.sks_backup(date) from public,anon,authenticated;
grant execute on function sks_private.sks_backup(date) to authenticated;
create function public.sks_backup(p_day date) returns jsonb language sql security invoker set search_path='' as $$ select sks_private.sks_backup(p_day) $$;
revoke all on function public.sks_backup(date) from public,anon,authenticated;
grant execute on function public.sks_backup(date) to authenticated;
alter table public.sks_templates add constraint template_valid_fields check(length(trim(title)) between 1 and 200 and length(description)<=5000 and category in ('Görsel tasarım','Video ve kurgu','İçerik ve metin','Fotoğraf ve çekim','Yayın hazırlığı','Raporlama') and priority in ('Düşük','Normal','Yüksek','Acil'));
create policy access_list_no_client_access on sks_private.access_list for all to authenticated using(false) with check(false);
create policy backups_no_client_access on sks_private.backups for all to authenticated using(false) with check(false);
