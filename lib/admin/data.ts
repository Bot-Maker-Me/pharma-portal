'use client'

import { createClient } from '@/lib/supabase/client'
import type { WorkspaceSectionKey } from '@/lib/workspace/sections'

// Data access for the admin console. Everything here is protected by RLS: only
// platform admins can read other tenants, and only tenant admins/platform admins
// can write content.

export type AdminUser = {
  userId: string
  email: string
  fullName: string
  profileRole: string
  organization: string | null
  tenantId: string | null
  tenantName: string | null
  tenantRole: string | null
  isPlatformAdmin: boolean
  homeIds: string[]
}

export type AdminHome = { id: string; name: string }
export type AdminTenant = { id: string; name: string; plan: string }

export type ContentItem = {
  id: string
  section: string
  title: string
  body: string | null
}

export type FormularyItem = {
  id: string
  chemicalName: string
  preferredGeneric: string | null
  preferredDin: string | null
  alternateGeneric: string | null
  alternateDin: string | null
  notes: string | null
}

export type TenantContent = {
  content: ContentItem[]
  formulary: FormularyItem[]
}

type PostgrestLikeError = { message?: string; details?: string | null; hint?: string | null }

function fail(error: unknown): never {
  if (error instanceof Error) throw error
  const detail = error as PostgrestLikeError | null
  const parts = [detail?.message, detail?.details, detail?.hint].filter(Boolean)
  throw new Error(parts.length ? parts.join(' · ') : 'The request failed.')
}

function db() {
  const client = createClient()
  if (!client) throw new Error('Supabase is not configured.')
  return client
}

export async function loadUsers(): Promise<AdminUser[]> {
  const { data, error } = await db().rpc('admin_list_users')
  if (error) fail(error)
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    userId: String(row.user_id),
    email: String(row.email ?? ''),
    fullName: String(row.full_name ?? ''),
    profileRole: String(row.profile_role ?? 'pharmacy'),
    organization: (row.organization as string | null) ?? null,
    tenantId: (row.tenant_id as string | null) ?? null,
    tenantName: (row.tenant_name as string | null) ?? null,
    tenantRole: (row.tenant_role as string | null) ?? null,
    isPlatformAdmin: Boolean(row.is_platform_admin),
    homeIds: ((row.home_ids as string[] | null) ?? []).map(String),
  }))
}

export async function loadHomes(): Promise<AdminHome[]> {
  const { data, error } = await db().from('homes').select('id, name').order('name')
  if (error) fail(error)
  return (data ?? []) as AdminHome[]
}

export async function loadTenants(): Promise<AdminTenant[]> {
  const { data, error } = await db().from('tenants').select('id, name, plan').order('name')
  if (error) fail(error)
  return (data ?? []) as AdminTenant[]
}

export async function createTenant(name: string): Promise<void> {
  const { error } = await db().from('tenants').insert({ name })
  if (error) fail(error)
}

/** Removes a pharmacy workspace. Its content and memberships cascade away with it. */
export async function deleteTenant(tenantId: string): Promise<void> {
  const { error } = await db().from('tenants').delete().eq('id', tenantId)
  if (error) fail(error)
}

export async function createHome(name: string): Promise<void> {
  const { error } = await db().from('homes').insert({ name })
  if (error) fail(error)
}

export async function deleteHome(homeId: string): Promise<void> {
  const { error } = await db().from('homes').delete().eq('id', homeId)
  if (error) fail(error)
}

export async function saveProfile(
  userId: string,
  input: { fullName: string; organization: string; profileRole: string },
): Promise<void> {
  const { error } = await db()
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: input.fullName,
        organization: input.organization || null,
        role: input.profileRole,
      },
      { onConflict: 'id' },
    )
  if (error) fail(error)
}

/** Replaces the user's tenant membership with a single membership. */
export async function setUserTenant(userId: string, tenantId: string | null, role: string): Promise<void> {
  const client = db()
  const { error: clearError } = await client.from('tenant_members').delete().eq('user_id', userId)
  if (clearError) fail(clearError)
  if (!tenantId) return
  const { error } = await client
    .from('tenant_members')
    .insert({ tenant_id: tenantId, user_id: userId, role, is_active: true })
  if (error) fail(error)
}

export async function setHomeAccess(userId: string, homeId: string, granted: boolean): Promise<void> {
  const client = db()
  if (granted) {
    const { error } = await client
      .from('pharmacy_home_access')
      .upsert({ pharmacy_user_id: userId, home_id: homeId }, { onConflict: 'pharmacy_user_id,home_id' })
    if (error) fail(error)
    return
  }
  const { error } = await client
    .from('pharmacy_home_access')
    .delete()
    .eq('pharmacy_user_id', userId)
    .eq('home_id', homeId)
  if (error) fail(error)
}

export async function setPlatformAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const client = db()
  if (isAdmin) {
    const { error } = await client.from('platform_admins').upsert({ user_id: userId }, { onConflict: 'user_id' })
    if (error) fail(error)
    return
  }
  const { error } = await client.from('platform_admins').delete().eq('user_id', userId)
  if (error) fail(error)
}

export async function loadTenantContent(tenantId: string): Promise<TenantContent> {
  const client = db()
  const [contentResult, formularyResult] = await Promise.all([
    client.from('tenant_content').select('id, section, title, body').eq('tenant_id', tenantId).order('position'),
    client
      .from('formulary_items')
      .select('id, chemical_name, preferred_generic, preferred_din, alternate_generic, alternate_din, notes')
      .eq('tenant_id', tenantId)
      .order('chemical_name'),
  ])
  if (contentResult.error) fail(contentResult.error)
  if (formularyResult.error) fail(formularyResult.error)

  return {
    content: ((contentResult.data ?? []) as ContentItem[]).map((row) => ({
      id: row.id,
      section: row.section,
      title: row.title,
      body: row.body,
    })),
    formulary: ((formularyResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      chemicalName: String(row.chemical_name ?? ''),
      preferredGeneric: (row.preferred_generic as string | null) ?? null,
      preferredDin: (row.preferred_din as string | null) ?? null,
      alternateGeneric: (row.alternate_generic as string | null) ?? null,
      alternateDin: (row.alternate_din as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    })),
  }
}

export async function addContentItem(input: {
  tenantId: string
  section: WorkspaceSectionKey
  title: string
  body: string
}): Promise<void> {
  const { error } = await db()
    .from('tenant_content')
    .insert({ tenant_id: input.tenantId, section: input.section, title: input.title, body: input.body || null })
  if (error) fail(error)
}

export async function deleteContentItem(id: string): Promise<void> {
  const { error } = await db().from('tenant_content').delete().eq('id', id)
  if (error) fail(error)
}

export async function addFormularyItem(input: {
  tenantId: string
  chemicalName: string
  preferredGeneric: string
  preferredDin: string
  alternateGeneric: string
  alternateDin: string
  notes: string
}): Promise<void> {
  const { error } = await db().from('formulary_items').insert({
    tenant_id: input.tenantId,
    chemical_name: input.chemicalName,
    preferred_generic: input.preferredGeneric || null,
    preferred_din: input.preferredDin || null,
    alternate_generic: input.alternateGeneric || null,
    alternate_din: input.alternateDin || null,
    notes: input.notes || null,
  })
  if (error) fail(error)
}

export async function deleteFormularyItem(id: string): Promise<void> {
  const { error } = await db().from('formulary_items').delete().eq('id', id)
  if (error) fail(error)
}
