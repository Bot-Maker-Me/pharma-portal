import { ImageResponse } from 'next/og'

/**
 * The app/tab icon: the Pharma Portal mark — a white plus on the brand red tile,
 * matching the `.wordmark-mark` used beside the wordmark on the site.
 *
 * `public/icon.svg` stays the vector twin, but Safari (and iOS home-screen /
 * notification surfaces) do not render SVG favicons, so they need a raster icon.
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
          background: '#c8102e',
          borderRadius: 116,
        }}
      >
        <div style={{ position: 'relative', width: 300, height: 300, display: 'flex' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 117,
              width: 300,
              height: 66,
              borderRadius: 8,
              background: '#ffffff',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 117,
              top: 0,
              width: 66,
              height: 300,
              borderRadius: 8,
              background: '#ffffff',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
