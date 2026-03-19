'use client'

import React from 'react'
import { NotificationProvider } from '@bakery/shared/contexts'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider enableRealTime={false}>
      {children}
    </NotificationProvider>
  )
}
