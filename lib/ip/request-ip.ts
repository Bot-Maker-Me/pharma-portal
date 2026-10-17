/**
 * The client IP for an incoming request, resolved from platform headers only.
 *
 * The browser can set neither `x-real-ip` nor `x-forwarded-for` on a request
 * that reaches the host's edge — the edge overwrites both with the real peer
 * address. We therefore trust only those two, and never derive an IP from a
 * query string, a body field, a cookie, or any other client-settable value.
 *
 * A missing/unparseable address becomes the sentinel "unknown", which the
 * database treats as a fail-open input (see public.ip_guard).
 */
export const UNKNOWN_CLIENT_IP = 'unknown'

export function resolveClientIp(headers: Headers): string {
  // The host's edge sets a single, authoritative address here.
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return normalizeClientIp(realIp)

  // Fall back to the first hop in the forwarded chain. The edge replaces the
  // whole header, so the first entry is the true peer, not a client-supplied one.
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return normalizeClientIp(first)
  }

  return UNKNOWN_CLIENT_IP
}

// "::ffff:1.2.3.4" (an IPv4 address carried in an IPv6 header) collapses to
// "1.2.3.4" so it can be matched against the allowlist's inet CIDRs.
function normalizeClientIp(value: string): string {
  const ipv4Mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value)
  return ipv4Mapped ? ipv4Mapped[1] : value
}
