'use client'

import React from 'react'

const Baeckerei: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="currentColor"
    suppressHydrationWarning
  >
    <circle
      cx="20"
      cy="20"
      r="18"
      strokeWidth="2"
      stroke="currentColor"
      fill="none"
    />
    <text x="20" y="25" textAnchor="middle" fontSize="16" fontWeight="bold">
      B
    </text>
  </svg>
)

export default Baeckerei
