create index sks_notifications_task_idx on public.sks_notifications(task_id);
drop policy templates_write on public.sks_templates;
create policy templates_insert on public.sks_templates for insert to authenticated with check((select sks_private.current_role())='manager');
create policy templates_update on public.sks_templates for update to authenticated using((select sks_private.current_role())='manager') with check((select sks_private.current_role())='manager');
create policy templates_delete on public.sks_templates for delete to authenticated using((select sks_private.current_role())='manager');
