import { ImageResponse } from 'next/og'

/**
 * The iOS home-screen icon.
 *
 * This is also the mark iOS shows on a web push notification from an installed
 * PWA, so it must be a PNG — iOS ignores the SVG. Shape stays inside the safe
 * zone so iOS can apply its own rounded-corner mask.
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
          background: '#0b1220',
        }}
      >
        <div style={{ position: 'relative', width: 100, height: 100, display: 'flex' }}>
          <div
            style={{
              position: 'absolute',
              left: 39,
              top: 0,
              width: 22,
              height: 100,
              borderRadius: 6,
              background: '#d8232f',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 39,
              left: 0,
              width: 100,
              height: 22,
              borderRadius: 6,
              background: '#d8232f',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
