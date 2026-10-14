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
 */
export const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

/** True when the deployment has a public key to subscribe with. */
export function hasVapidPublicKey(): boolean {
  return vapidPublicKey.length > 0
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
