-- ============================================================================
--  Add the pharmacy "Pharmasave West Hills" with its own Pharmasave theme.
--
--  Run in Supabase → SQL Editor, against the Pharmasave portal's project.
--  HOW TO RUN: press Ctrl+A to select the WHOLE file, then Run. Every statement
--  is complete on its own, so running a subset is safe — but you want all of them.
--
--  What it does:
--    1. Makes sure tenants.theme exists (same statement as
--       20261020000000_tenant_theme_and_chat_archive.sql — harmless if that
--       migration already ran).
--    2. Creates the tenant "Pharmasave West Hills" with theme = 'pharmasave'.
--       That theme key is what paints every screen this pharmacy opens in the
--       Pharmasave red. No other pharmacy is affected: the key is per tenant.
--    3. Switches on every base feature for it.
--    4. Attaches the platform admins as owners, so the themed workspace and chat
--       are reachable immediately. Adjust or delete step 4 to attach someone else.
--
--  This file is NOT a migration. It lives outside supabase/migrations/ so it is
--  never applied automatically.
-- ============================================================================

-- The pharmacy this script creates.
--   name  → shown in the workspace header, admin console and chat.
--   plan  → free-form label; 'pro' matches the other workspaces.
--   theme → must match a key in lib/tenant/theme.ts ('default' | 'pharmasave').
--           'pharmasave' paints the red palette from app/globals.css.


-- ---------------------------------------------------------------------------
-- 1. The theme column.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists theme text not null default 'default';


-- ---------------------------------------------------------------------------
-- 2. The pharmacy itself (idempotent: re-running only re-asserts the theme).
-- ---------------------------------------------------------------------------
insert into public.tenants (name, plan, theme)
select 'Pharmasave West Hills', 'pro', 'pharmasave'
where not exists (select 1 from public.tenants where name = 'Pharmasave West Hills');

update public.tenants
   set plan  = 'pro',
       theme = 'pharmasave'
 where name = 'Pharmasave West Hills';


-- ---------------------------------------------------------------------------
-- 3. Every base feature, switched on for this pharmacy only.
-- ---------------------------------------------------------------------------
insert into public.tenant_features (tenant_id, feature_key, enabled)
select t.id, f.key, true
from public.tenants t
cross join public.features f
where t.name = 'Pharmasave West Hills'
  and f.type = 'base'
on conflict (tenant_id, feature_key) do update set enabled = true;


-- ---------------------------------------------------------------------------
-- 4. Give the platform admins access, so the branded workspace can be opened
--    straight away. (Skip or change this if the pharmacy's own staff should be
--    the only members — add them from Admin console → Users & access.)
-- ---------------------------------------------------------------------------
insert into public.tenant_members (tenant_id, user_id, role, is_active)
select t.id, pa.user_id, 'owner', true
from public.tenants t
cross join public.platform_admins pa
where t.name = 'Pharmasave West Hills'
on conflict (tenant_id, user_id) do update set role = 'owner', is_active = true;


-- ---------------------------------------------------------------------------
-- 5. Verify — you want theme = pharmasave, members ≥ 1, features = 8.
-- ---------------------------------------------------------------------------
select
  t.name                                        as pharmacy,
  t.plan,
  t.theme,
  (select count(*) from public.tenant_members  m where m.tenant_id = t.id) as members,
  (select count(*) from public.tenant_features f where f.tenant_id = t.id and f.enabled) as features
from public.tenants t
where t.name = 'Pharmasave West Hills';
