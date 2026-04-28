-- Private storage bucket + RLS policies for maintenance media uploads.
-- Path convention used by app:
--   <tenant_id>/<maintenance_request_id>/<timestamp>-<sanitized_filename>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-media',
  'maintenance-media',
  false,
  31457280,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists maintenance_media_tenant_insert on storage.objects;
create policy maintenance_media_tenant_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'maintenance-media'
    and exists (
      select 1
      from public.tenants t
      join public.maintenance_requests mr
        on mr.tenant_id = t.id
      where t.user_id = auth.uid()
        and t.id = split_part(name, '/', 1)::bigint
        and mr.id = split_part(name, '/', 2)::bigint
    )
  );

drop policy if exists maintenance_media_tenant_select on storage.objects;
create policy maintenance_media_tenant_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'maintenance-media'
    and exists (
      select 1
      from public.tenants t
      where t.user_id = auth.uid()
        and t.id = split_part(name, '/', 1)::bigint
    )
  );

drop policy if exists maintenance_media_tenant_delete on storage.objects;
create policy maintenance_media_tenant_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'maintenance-media'
    and exists (
      select 1
      from public.tenants t
      where t.user_id = auth.uid()
        and t.id = split_part(name, '/', 1)::bigint
    )
  );

drop policy if exists maintenance_media_tenant_update on storage.objects;
create policy maintenance_media_tenant_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'maintenance-media'
    and exists (
      select 1
      from public.tenants t
      where t.user_id = auth.uid()
        and t.id = split_part(name, '/', 1)::bigint
    )
  )
  with check (
    bucket_id = 'maintenance-media'
    and exists (
      select 1
      from public.tenants t
      where t.user_id = auth.uid()
        and t.id = split_part(name, '/', 1)::bigint
    )
  );

drop policy if exists maintenance_media_landlord_select on storage.objects;
create policy maintenance_media_landlord_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'maintenance-media'
    and exists (
      select 1
      from public.maintenance_requests mr
      join public.tenants t
        on t.id = mr.tenant_id
      where mr.id = split_part(name, '/', 2)::bigint
        and t.owner_id = auth.uid()
    )
  );
