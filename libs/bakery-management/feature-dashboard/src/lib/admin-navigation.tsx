import React from 'react'

export interface AdminNavigationProps {
  children?: React.ReactNode
}

export function AdminNavigation({ children }: AdminNavigationProps) {
  return (
    <nav>
      {/* Placeholder for admin navigation */}
      {children}
    </nav>
  )
}
