-- Apply this migration in the Pharma-Portal Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.features (
  key text primary key,
  name text not null,
  description text not null default '',
  type text not null check (type in ('base', 'custom')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.tenant_features (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  notes text,
  primary key (tenant_id, feature_key)
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  tenant_id uuid references public.tenants(id) on delete set null,
  feature_key text,
  action text not null check (action in ('grant', 'revoke', 'config_change', 'tenant_preview')),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

alter table public.features enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_features enable row level security;
alter table public.platform_admins enable row level security;
alter table public.feature_audit_log enable row level security;

create or replace function public.is_platform_admin() returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- Policies are dropped first so this migration can be re-run safely.
drop policy if exists features_read_active on public.features;
create policy features_read_active on public.features for select to authenticated using (is_active = true or (select public.is_platform_admin()));
drop policy if exists features_platform_write on public.features;
create policy features_platform_write on public.features for all to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
drop policy if exists tenants_member_read on public.tenants;
create policy tenants_member_read on public.tenants for select to authenticated using (exists (select 1 from public.tenant_members m where m.tenant_id = id and m.user_id = (select auth.uid()) and m.is_active));
drop policy if exists members_self_read on public.tenant_members;
create policy members_self_read on public.tenant_members for select to authenticated using (user_id = (select auth.uid()) or (select public.is_platform_admin()));
drop policy if exists tenant_features_member_read on public.tenant_features;
create policy tenant_features_member_read on public.tenant_features for select to authenticated using (enabled and exists (select 1 from public.tenant_members m where m.tenant_id = tenant_id and m.user_id = (select auth.uid()) and m.is_active));
drop policy if exists tenant_features_platform_write on public.tenant_features;
create policy tenant_features_platform_write on public.tenant_features for all to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
drop policy if exists platform_admins_self_read on public.platform_admins;
create policy platform_admins_self_read on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists audit_platform_read on public.feature_audit_log;
create policy audit_platform_read on public.feature_audit_log for select to authenticated using ((select public.is_platform_admin()));
drop policy if exists audit_platform_insert on public.feature_audit_log;
create policy audit_platform_insert on public.feature_audit_log for insert to authenticated with check ((select public.is_platform_admin()) and actor_id = (select auth.uid()));

insert into public.features (key, name, description, type) values
('formulary', 'Formulary', 'Preferred medicines and substitution rules.', 'base'),
('sops', 'SOPs & Policies', 'Searchable procedures and policy versions.', 'base'),
('opening-closing', 'Opening / Closing', 'Daily opening and closing checklists.', 'base')
on conflict (key) do update set name = excluded.name, description = excluded.description;

-- Privileges. Row level security still decides what each row a caller may touch;
-- these grants only make the tables reachable at all.
grant usage on schema public to anon, authenticated;

grant select on public.features, public.tenants, public.tenant_members,
  public.tenant_features, public.platform_admins, public.feature_audit_log
  to authenticated;
grant insert, update, delete on public.features, public.tenant_features to authenticated;
grant insert on public.feature_audit_log to authenticated;

grant execute on function public.is_platform_admin() to anon, authenticated;
