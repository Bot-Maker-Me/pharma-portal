-- ============================================================================
--  Seed / repair a platform-admin login.
--
--  Run this in Supabase → SQL Editor against the shared project (the one the
--  Pharma Portal connects to). Safe to re-run: it creates the account if it is
--  missing and just resets the password if it already exists.
--
--  ⚠  EDIT THE FIVE VALUES IN THE `declare` BLOCK BELOW, THEN RUN THE WHOLE FILE.
--  ⚠  Do NOT commit a real password. Keep this file's password as a placeholder
--     and paste your real one straight into the SQL Editor instead.
--
--  This is NOT a migration — it lives outside supabase/migrations/ so it is
--  never applied automatically.
-- ============================================================================

do $$
declare
  admin_email    text := 'piyush80545@gmail.com';          -- login email
  admin_password text := 'REPLACE-WITH-A-STRONG-PASSWORD'; -- min 6 characters
  admin_name     text := 'Piyush';                         -- display name
  org_name       text := 'Pharma Strategies';              -- organisation shown in the UI
  tenant_name    text := 'Pharma Strategies';              -- the pharmacy tenant this admin owns

  admin_id uuid;
  tenant   uuid;
begin
  -- ------------------------------------------------------------------------
  -- 1. The auth account. GoTrue stores passwords as bcrypt hashes, so we hash
  --    here with crypt() from pgcrypto. Confirming the email means you can sign
  --    in immediately without clicking a confirmation link.
  -- ------------------------------------------------------------------------
  select id into admin_id from auth.users where email = admin_email;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      admin_email, crypt(admin_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );

    -- GoTrue also expects an identity row for email/password accounts.
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true),
      'email', now(), now(), now()
    );

    raise notice 'Created auth user %', admin_email;
  else
    update auth.users
       set encrypted_password = crypt(admin_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = admin_id;

    raise notice 'Reset password for existing auth user %', admin_email;
  end if;

  -- ------------------------------------------------------------------------
  -- 2. Profile — the display name / organisation the UI reads.
  -- ------------------------------------------------------------------------
  insert into public.profiles (id, full_name, role, organization)
  values (admin_id, admin_name, 'pharmacy', org_name)
  on conflict (id) do update
    set full_name    = excluded.full_name,
        organization = excluded.organization;

  -- ------------------------------------------------------------------------
  -- 3. The admin grant. This is what actually unlocks /admin.
  -- ------------------------------------------------------------------------
  insert into public.platform_admins (user_id)
  values (admin_id)
  on conflict (user_id) do nothing;

  -- ------------------------------------------------------------------------
  -- 4. A tenant to own, with this admin as its owner. Without a tenant
  --    membership /workspace has nothing to show.
  -- ------------------------------------------------------------------------
  select id into tenant from public.tenants where name = tenant_name;

  if tenant is null then
    insert into public.tenants (name, plan)
    values (tenant_name, 'pro')
    returning id into tenant;
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, is_active)
  values (tenant, admin_id, 'owner', true)
  on conflict (tenant_id, user_id) do update
    set role = 'owner', is_active = true;

  -- ------------------------------------------------------------------------
  -- 5. Turn the base features on for that tenant.
  -- ------------------------------------------------------------------------
  insert into public.tenant_features (tenant_id, feature_key, enabled)
  select tenant, f.key, true from public.features f where f.type = 'base'
  on conflict (tenant_id, feature_key) do update set enabled = true;

  raise notice 'Done. Sign in as % with the password you set above.', admin_email;
end $$;

-- ---------------------------------------------------------------------------
-- Verify
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
