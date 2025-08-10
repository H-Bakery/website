'use client'
import dynamic from 'next/dynamic'

// Dynamically import the OpenStreetMap component with SSR disabled
const DynamicMap = dynamic(() => import('./OpenStreetMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', width: '100%', background: '#f0f0f0' }}>
      Loading map...
    </div>
  ),
})

export default DynamicMap
