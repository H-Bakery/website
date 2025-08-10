import React from 'react'

const Wappen: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor">
    <path
      d="M20 5 L35 15 L35 30 L20 35 L5 30 L5 15 Z"
      strokeWidth="2"
      stroke="currentColor"
      fill="none"
    />
    <text x="20" y="24" textAnchor="middle" fontSize="14" fontWeight="bold">
      W
    </text>
  </svg>
)

export default Wappen
