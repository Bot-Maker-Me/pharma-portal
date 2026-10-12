-- ============================================================================
--  Create / repair a platform-admin login.
--
--  Run in Supabase → SQL Editor, against the shared project (the one the
--  Pharma Portal connects to).
--
--  HOW TO RUN: press Ctrl+A to select the WHOLE file, then Run.
--  Every statement below is complete on its own, so running a subset is safe —
--  but you want all of them.
--
--  BEFORE YOU RUN: edit step 2 and put your real password in place of
--  REPLACE-WITH-A-STRONG-PASSWORD (6+ characters).
--  Leave the placeholder in this file — never commit a real password.
--
--  This is NOT a migration. It lives outside supabase/migrations/ so it is
--  never applied automatically.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Make sure the auth account exists.
--    Passwords are bcrypt-hashed by Supabase Auth, so we hash with crypt().
--    The password here is random filler — step 2 sets the real one.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'piyush80545@gmail.com',
  crypt(gen_random_uuid()::text, gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', ''
where not exists (
  select 1 from auth.users where email = 'piyush80545@gmail.com'
)
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- 2. ★★★ SET YOUR PASSWORD HERE ★★★
--    Confirming the email lets you sign in straight away.
-- ---------------------------------------------------------------------------
update auth.users
   set encrypted_password  = crypt('REPLACE-WITH-A-STRONG-PASSWORD', gen_salt('bf')),
       email_confirmed_at  = coalesce(email_confirmed_at, now()),
       updated_at          = now()
 where email = 'piyush80545@gmail.com';


-- ---------------------------------------------------------------------------
-- 3. Identity row — GoTrue expects one for email/password accounts.
-- ---------------------------------------------------------------------------
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email = 'piyush80545@gmail.com'
  and not exists (select 1 from auth.identities i where i.user_id = u.id)
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- 4. Profile — display name and organisation shown in the UI.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, role, organization)
select u.id, 'Piyush', 'pharmacy', 'Pharma Strategies'
from auth.users u
where u.email = 'piyush80545@gmail.com'
on conflict (id) do update
  set full_name    = excluded.full_name,
      organization = excluded.organization;


-- ---------------------------------------------------------------------------
-- 5. The admin grant. THIS is what unlocks /admin.
-- ---------------------------------------------------------------------------
insert into public.platform_admins (user_id)
select u.id
from auth.users u
where u.email = 'piyush80545@gmail.com'
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------------
-- 6. A tenant to own. Without a tenant membership /workspace has nothing to
--    show you.
-- ---------------------------------------------------------------------------
insert into public.tenants (name, plan)
select 'Pharma Strategies', 'pro'
where not exists (select 1 from public.tenants where name = 'Pharma Strategies');

insert into public.tenant_members (tenant_id, user_id, role, is_active)
select t.id, u.id, 'owner', true
from public.tenants t
cross join auth.users u
where t.name = 'Pharma Strategies'
  and u.email = 'piyush80545@gmail.com'
on conflict (tenant_id, user_id) do update
  set role = 'owner', is_active = true;


-- ---------------------------------------------------------------------------
-- 7. Switch the base features on for that tenant.
-- ---------------------------------------------------------------------------
insert into public.tenant_features (tenant_id, feature_key, enabled)
select t.id, f.key, true
from public.tenants t
cross join public.features f
where t.name = 'Pharma Strategies'
  and f.type = 'base'
on conflict (tenant_id, feature_key) do update set enabled = true;


-- ---------------------------------------------------------------------------
-- 8. Verify — you want confirmed = true and is_platform_admin = true.
-- ---------------------------------------------------------------------------
select
  u.email,
  u.email_confirmed_at is not null as confirmed,
  (pa.user_id is not null)          as is_platform_admin,
  t.name                            as tenant,
  tm.role                           as tenant_role
from auth.users u
left join public.platform_admins pa on pa.user_id = u.id
left join public.tenant_members  tm on tm.user_id = u.id
left join public.tenants         t  on t.id = tm.tenant_id
where u.email = 'piyush80545@gmail.com';
