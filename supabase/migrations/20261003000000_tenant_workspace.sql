-- Tenant-scoped workspace content + the helpers the admin console needs.
--
-- Every piece of workspace content belongs to exactly one tenant (a pharmacy).
-- RLS means a signed-in user only ever sees their own tenant's rows — two tenants
-- can store identical data and they will never see each other's copy.

-- ---------------------------------------------------------------------------
-- Tenant helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select tm.tenant_id
  from public.tenant_members tm
  where tm.user_id = (select auth.uid()) and tm.is_active
  order by tm.created_at
  limit 1;
$$;

create or replace function public.is_tenant_member(target_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = target_tenant and tm.user_id = (select auth.uid()) and tm.is_active
  );
$$;

create or replace function public.is_tenant_admin(target_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = target_tenant and tm.user_id = (select auth.uid())
      and tm.is_active and tm.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Content: the formulary keeps its own structured columns.
-- ---------------------------------------------------------------------------
create table if not exists public.formulary_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chemical_name text not null,
  preferred_generic text,
  preferred_din text,
  alternate_generic text,
  alternate_din text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists formulary_items_tenant_idx on public.formulary_items (tenant_id, chemical_name);

-- ---------------------------------------------------------------------------
-- Content: every other section (procedures, contacts, forms, resources…).
-- `section` is the key the workspace renders, e.g. 'opening', 'emergency'.
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_content (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  section text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_content_tenant_section_idx on public.tenant_content (tenant_id, section, position);

-- ---------------------------------------------------------------------------
-- RLS on the content tables
-- ---------------------------------------------------------------------------
alter table public.formulary_items enable row level security;
alter table public.tenant_content enable row level security;

drop policy if exists formulary_member_read on public.formulary_items;
create policy formulary_member_read on public.formulary_items
  for select to authenticated
  using (public.is_tenant_member(tenant_id) or (select public.is_platform_admin()));

drop policy if exists formulary_admin_write on public.formulary_items;
create policy formulary_admin_write on public.formulary_items
  for all to authenticated
  using (public.is_tenant_admin(tenant_id) or (select public.is_platform_admin()))
  with check (public.is_tenant_admin(tenant_id) or (select public.is_platform_admin()));

drop policy if exists tenant_content_member_read on public.tenant_content;
create policy tenant_content_member_read on public.tenant_content
  for select to authenticated
  using (public.is_tenant_member(tenant_id) or (select public.is_platform_admin()));

drop policy if exists tenant_content_admin_write on public.tenant_content;
create policy tenant_content_admin_write on public.tenant_content
  for all to authenticated
  using (public.is_tenant_admin(tenant_id) or (select public.is_platform_admin()))
  with check (public.is_tenant_admin(tenant_id) or (select public.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Let platform admins manage tenants, memberships, homes, access and profiles.
-- Policies are OR'd, so the existing member-facing read policies still apply.
-- ---------------------------------------------------------------------------
drop policy if exists tenants_platform_write on public.tenants;
create policy tenants_platform_write on public.tenants
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

drop policy if exists members_platform_write on public.tenant_members;
create policy members_platform_write on public.tenant_members
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

drop policy if exists homes_platform_write on public.homes;
create policy homes_platform_write on public.homes
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

drop policy if exists pharmacy_access_platform_write on public.pharmacy_home_access;
create policy pharmacy_access_platform_write on public.pharmacy_home_access
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

drop policy if exists profiles_platform_write on public.profiles;
create policy profiles_platform_write on public.profiles
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- One call that returns every user with their tenant, role and assigned homes.
-- Security definer because it reads auth.users (emails) and crosses tenants.
-- It self-guards: a non platform-admin gets zero rows.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  profile_role text,
  organization text,
  tenant_id uuid,
  tenant_name text,
  tenant_role text,
  is_platform_admin boolean,
  home_ids uuid[]
)
language sql stable security definer set search_path = '' as $$
  select
    u.id,
    u.email::text,
    coalesce(p.full_name, ''),
    coalesce(p.role, 'pharmacy'),
    p.organization,
    tm.tenant_id,
    t.name,
    tm.role,
    exists (select 1 from public.platform_admins pa where pa.user_id = u.id),
    coalesce(
      (select array_agg(a.home_id) from public.pharmacy_home_access a where a.pharmacy_user_id = u.id),
      '{}'::uuid[]
    )
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.tenant_members tm on tm.user_id = u.id and tm.is_active
  left join public.tenants t on t.id = tm.tenant_id
  where public.is_platform_admin()
  order by u.created_at desc;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.formulary_items, public.tenant_content to authenticated;
grant insert, update, delete on public.formulary_items, public.tenant_content to authenticated;

grant select on public.tenants, public.tenant_members, public.platform_admins to authenticated;
grant insert, update, delete on public.tenants, public.tenant_members to authenticated;
grant insert, update, delete on public.homes, public.pharmacy_home_access to authenticated;
grant insert, delete on public.platform_admins to authenticated;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_tenant_admin(uuid) to authenticated;
