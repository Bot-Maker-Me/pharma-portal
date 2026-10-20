import { notFound } from 'next/navigation'
import { gateFeature } from '@/lib/features/server'
import { AdminPreviewNotice, FeatureUnavailable } from '@/components/features/feature-gate'

export default async function FeatureWorkspacePage({ params }: { params: Promise<{ feature: string }> }) {
  const { feature: featureKey } = await params
  // Unknown keys 404; a known feature that is off for the pharmacy shows the
  // friendly unavailable page instead — unless a platform admin is previewing it.
  const gate = await gateFeature(featureKey)
  if (gate.state === 'no-tenant') notFound()
  if (gate.state === 'off') return <FeatureUnavailable label={gate.feature.name} />
  if (!gate.feature.load) notFound()

  const LoadedFeature = (await gate.feature.load()).default
  if (gate.state === 'admin-preview') {
    return (
      <>
        <div className="p-4">
          <AdminPreviewNotice label={gate.feature.name} />
        </div>
        <LoadedFeature />
      </>
    )
  }
  return <LoadedFeature />
}
