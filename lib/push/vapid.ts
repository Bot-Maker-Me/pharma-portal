/**
 * The VAPID *public* key.
 *
 * It is not a secret — every browser that subscribes is handed it by design, which
 * is why it may live in the client bundle. It comes from the environment anyway so
 * a deployment can rotate the key pair without a code change.
 *
 * The private half never leaves the `send-push` Edge Function's secrets. It must
 * never be added to this app, to `.env.local`, or to any `NEXT_PUBLIC_*` variable:
 * anything prefixed `NEXT_PUBLIC_` is inlined into the JavaScript every visitor
 * downloads.
 *
 * This is a Next.js app, so the variable is `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. The
 * reference below must stay statically written as `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`
 * — Next.js inlines that exact expression at build time, but it cannot inline a
 * dynamic lookup such as `process.env[name]`, which would arrive `undefined`.
 */
const rawVapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

/** Drop line breaks and any stray spaces a copy-paste into the dashboard added. */
function cleanVapidPublicKey(value: string): string {
  return value.replace(/\s+/g, '')
}

/** The public key, cleaned, or an empty string when the deployment has none. */
export const vapidPublicKey = cleanVapidPublicKey(rawVapidPublicKey)

/** Why the key cannot be used, or `configured` when it is ready. */
export type VapidKeyStatus = 'configured' | 'missing' | 'invalid'

/**
 * A VAPID public key is an uncompressed P-256 point in URL-safe base64: it starts
 * with "B", is ~87 characters long, and only uses `A-Z a-z 0-9 - _`.
 */
export function vapidKeyStatus(): VapidKeyStatus {
  if (vapidPublicKey.length === 0) return 'missing'
  if (!vapidPublicKey.startsWith('B')) return 'invalid'
  if (vapidPublicKey.length < 85 || vapidPublicKey.length > 90) return 'invalid'
  if (!/^[A-Za-z0-9_-]+$/.test(vapidPublicKey)) return 'invalid'
  return 'configured'
}

/** True when the deployment has a usable public key to subscribe with. */
export function hasVapidPublicKey(): boolean {
  return vapidKeyStatus() === 'configured'
}

/**
 * `pushManager.subscribe` wants raw bytes, but the key is handed around as
 * base64url. This is the standard conversion: restore the stripped `=` padding,
 * put back the two characters base64url swaps out, then read it a byte at a time.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}
