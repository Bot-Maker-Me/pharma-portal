import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionTenant } from '@/lib/features/server'
import { loadTenantIdentity } from '@/lib/tenant/server'
import { defaultTenantTheme } from '@/lib/tenant/theme'
import { ChatExperience } from '@/components/chat/chat-experience'
import type { ChatIdentity } from '@/lib/chat/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Chat with Home · Formulary',
  description: 'Secure messaging between your pharmacy and the nursing homes you serve.',
}

export default async function ChatPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  let identity: ChatIdentity = {
    configured,
    signedIn: false,
    userId: null,
    displayName: 'Pharmacy team',
    organization: null,
    theme: defaultTenantTheme,
  }

  if (configured) {
    // Only signed-in pharmacy users may use Chat with Home.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/')

    const [profileResult, context] = await Promise.all([
      supabase.from('profiles').select('full_name, organization').eq('id', user.id).maybeSingle(),
      getSessionTenant(),
    ])
    const profile = profileResult.data

    // The pharmacy's branded theme travels with the session, so a pharmacy that
    // carries one gets it on every chat screen it opens.
    const theme = context ? (await loadTenantIdentity(context.tenantId)).theme : defaultTenantTheme

    identity = {
      configured,
      signedIn: true,
      userId: user.id,
      // `||` (not `??`) so an empty full_name falls through to the email prefix.
      displayName: profile?.full_name?.trim() || user.email?.split('@')[0] || 'Pharmacy team',
      organization: profile?.organization?.trim() || null,
      theme,
    }
  }

  return <ChatExperience identity={identity} />
}
