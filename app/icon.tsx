import { ImageResponse } from 'next/og'

/**
 * The app/tab icon, generated as a PNG.
 *
 * `public/icon.svg` stays the vector source, but Safari (and iOS home-screen /
 * notification surfaces) do not render SVG favicons, so they need a raster icon.
 * Emitting a PNG here keeps every surface on the Pharma Portal mark rather than
 * falling back to a browser default.
 */

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
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
        <div style={{ position: 'relative', width: 272, height: 272, display: 'flex' }}>
          <div
            style={{
              position: 'absolute',
              left: 106,
              top: 0,
              width: 60,
              height: 272,
              borderRadius: 16,
              background: '#d8232f',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 106,
              left: 0,
              width: 272,
              height: 60,
              borderRadius: 16,
              background: '#d8232f',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
