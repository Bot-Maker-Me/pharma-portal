import { ImageResponse } from 'next/og'

/**
 * The social / link-preview card.
 *
 * When a Pharma Portal link is shared — iMessage, WhatsApp, Slack, Teams — the
 * messaging app renders the page's Open Graph image. This file is that image, so
 * the preview wears the Pharma Portal mark and name instead of a blank card or
 * whatever the host platform falls back to.
 *
 * It is generated at build time (no binary asset to keep in sync) and follows the
 * brand tokens in `app/globals.css`: ink #0b1220, portal red #c8102e, paper #f6f4f1.
 */

export const alt = 'Pharma Portal — pharmacy workspace & Chat with Home'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#0b1220'
const RED = '#c8102e'
const PAPER = '#f6f4f1'
const MUTED = '#9fb0c9'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: '72px',
          color: PAPER,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 104,
              height: 104,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: RED,
              borderRadius: 26,
            }}
          >
            <div style={{ position: 'relative', width: 56, height: 56, display: 'flex' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 22,
                  top: 0,
                  width: 12,
                  height: 56,
                  borderRadius: 6,
                  background: '#ffffff',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 22,
                  left: 0,
                  width: 56,
                  height: 12,
                  borderRadius: 6,
                  background: '#ffffff',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', marginLeft: 32, fontSize: 34, letterSpacing: 8, color: MUTED }}>
            PHARMACY WORKSPACE
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 112, fontWeight: 700, letterSpacing: -3 }}>Pharma Portal</div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 40, color: MUTED }}>
            Secure messaging with the nursing homes you serve
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: '#7e8ea6' }}>
          PHARMA STRATEGIES
        </div>
      </div>
    ),
    { ...size },
  )
}
