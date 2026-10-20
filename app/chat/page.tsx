import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { gateFeature } from '@/lib/features/server'
import { chatWithHomeFeatureKey } from '@/lib/features/registry'
import { loadTenantIdentity } from '@/lib/tenant/server'
import { previewTenant } from '@/lib/tenant/preview'
import { ChatExperience } from '@/components/chat/chat-experience'
import { AdminPreviewNotice, FeatureUnavailable } from '@/components/features/feature-gate'
import type { ChatIdentity } from '@/lib/chat/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Chat with Home · Pharma Portal',
  description: 'Secure messaging between your pharmacy and the nursing homes you serve.',
}

export default async function ChatPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // Without credentials the app runs as the preview pharmacy, so the sample
  // mailbox is clearly labelled and wears that pharmacy's theme.
  if (!configured) {
    const identity: ChatIdentity = {
      configured: false,
      signedIn: false,
      userId: null,
      displayName: 'Pharmacy team',
      organization: previewTenant.name,
      theme: previewTenant.theme,
    }
    return <ChatExperience identity={identity} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Chat with Home is a per-pharmacy feature. When it is off the pharmacy gets the
  // friendly "not available yet" page instead of the content; a platform admin may
  // still open it, clearly marked as a preview.
  const gate = await gateFeature(chatWithHomeFeatureKey)
  if (gate.state === 'no-tenant') redirect('/workspace')
  if (gate.state === 'off') return <FeatureUnavailable label={gate.feature.name} />

  const [profileResult, tenant] = await Promise.all([
    supabase.from('profiles').select('full_name, organization').eq('id', gate.tenant.userId).maybeSingle(),
    loadTenantIdentity(gate.tenant.tenantId),
  ])
  const profile = profileResult.data

  const identity: ChatIdentity = {
    configured: true,
    signedIn: true,
    userId: gate.tenant.userId,
    // `||` (not `??`) so an empty full_name falls through to the email prefix.
    displayName: profile?.full_name?.trim() || user.email?.split('@')[0] || 'Pharmacy team',
    organization: profile?.organization?.trim() || null,
    theme: tenant.theme,
  }

  return (
    <>
      {gate.state === 'admin-preview' && (
        // Overlaid, not stacked, so the chat keeps the full viewport it expects.
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-2">
          <div className="pointer-events-auto w-full max-w-md">
            <AdminPreviewNotice label="Chat with Home" />
          </div>
        </div>
      )}
      <ChatExperience identity={identity} />
    </>
  )
}
