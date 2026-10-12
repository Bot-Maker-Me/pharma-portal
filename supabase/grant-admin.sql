-- ============================================================================
--  Grant platform-admin access to an EXISTING account.
--
--  This is the surgical version of seed-admin.sql: it does NOT create users and
--  does NOT touch passwords. It only adds the admin grant, a profile row, and a
--  tenant membership.
--
--  HOW TO RUN: Ctrl+A to select the whole file, then Run. No edits needed —
--  the email below is already set to the account you are signed in as.
--
--  To grant someone else later, find-and-replace param@pharmastrategies.ca with
--  their email (it appears three times).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Profile — display name and organisation.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, role, organization)
select u.id, split_part(u.email, '@', 1), 'pharmacy', 'Pharma Strategies'
from auth.users u
where u.email = 'param@pharmastrategies.ca'
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 2. The admin grant. THIS is what unlocks /admin.
-- ---------------------------------------------------------------------------
insert into public.platform_admins (user_id)
select u.id
from auth.users u
where u.email = 'param@pharmastrategies.ca'
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------------
-- 3. A tenant to belong to, with this account as owner. Without a tenant
--    membership /workspace has nothing to show.
-- ---------------------------------------------------------------------------
insert into public.tenants (name, plan)
select 'Pharma Strategies', 'pro'
where not exists (select 1 from public.tenants where name = 'Pharma Strategies');

insert into public.tenant_members (tenant_id, user_id, role, is_active)
select t.id, u.id, 'owner', true
from public.tenants t
cross join auth.users u
where t.name = 'Pharma Strategies'
  and u.email = 'param@pharmastrategies.ca'
on conflict (tenant_id, user_id) do update
  set role = 'owner', is_active = true;


-- ---------------------------------------------------------------------------
-- 4. Switch the base features on for that tenant.
-- ---------------------------------------------------------------------------
insert into public.tenant_features (tenant_id, feature_key, enabled)
select t.id, f.key, true
from public.tenants t
cross join public.features f
where t.name = 'Pharma Strategies'
  and f.type = 'base'
on conflict (tenant_id, feature_key) do update set enabled = true;


-- ---------------------------------------------------------------------------
-- 5. Verify — every account and whether it can open /admin.
-- ---------------------------------------------------------------------------
select
  u.email,
  (pa.user_id is not null) as is_platform_admin,
  t.name                   as tenant,
  tm.role                  as tenant_role
from auth.users u
left join public.platform_admins pa on pa.user_id = u.id
left join public.tenant_members  tm on tm.user_id = u.id
left join public.tenants         t  on t.id = tm.tenant_id
order by u.created_at;
