import { notFound } from 'next/navigation'
import { requireFeature } from '@/lib/features/server'
import { getFeature } from '@/lib/features/registry'

export default async function FeatureWorkspacePage({ params }: { params: Promise<{ feature: string }> }) {
  const { feature: featureKey } = await params
  const feature = getFeature(featureKey)
  if (!feature || feature.type !== 'custom') notFound()
  await requireFeature(feature.key)
  if (!feature.load) notFound()
  const LoadedFeature = (await feature.load()).default
  return <LoadedFeature />
}
