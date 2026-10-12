import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
  }

  if (configured) {
    // Only signed-in pharmacy users may use Chat with Home.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/')

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, organization')
      .eq('id', user.id)
      .maybeSingle()

    identity = {
      configured,
      signedIn: true,
      userId: user.id,
      // `||` (not `??`) so an empty full_name falls through to the email prefix.
      displayName: profile?.full_name?.trim() || user.email?.split('@')[0] || 'Pharmacy team',
      organization: profile?.organization?.trim() || null,
    }
  }

  return <ChatExperience identity={identity} />
}
