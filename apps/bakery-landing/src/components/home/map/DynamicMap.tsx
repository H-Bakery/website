'use client'
import dynamic from 'next/dynamic'
import type { MapProps } from './ReactLeafletMap'

// Dynamically import the ReactLeafletMap component with SSR disabled
const DynamicMap = dynamic<MapProps>(() => import('./ReactLeafletMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%',
        width: '100%',
        background: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Karte wird geladen...
    </div>
  ),
})

export default DynamicMap
export type { MapProps }
