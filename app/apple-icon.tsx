import { ImageResponse } from 'next/og'

/**
 * The iOS home-screen icon, and — because iOS ignores an SVG and an in-page SVG
 * icon in a notification — the image iOS puts on a web push from an installed PWA.
 * Same plus sign as the tab icon, sized for the home screen.
 */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#c8102e',
          borderRadius: 40,
        }}
      >
        <div style={{ position: 'relative', width: 106, height: 106, display: 'flex' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 41,
              width: 106,
              height: 24,
              borderRadius: 4,
              background: '#ffffff',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 41,
              top: 0,
              width: 24,
              height: 106,
              borderRadius: 4,
              background: '#ffffff',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
