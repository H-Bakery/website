import React from 'react'

export const Divider: React.FC = () => {
  return (
    <svg
      width="200"
      height="20"
      viewBox="0 0 200 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 10C22.222 10 44.444 10 66.667 10C88.889 10 111.111 10 133.333 10C155.556 10 177.778 10 200 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="100" cy="10" r="3" fill="currentColor" />
      <circle cx="85" cy="10" r="1.5" fill="currentColor" />
      <circle cx="115" cy="10" r="1.5" fill="currentColor" />
    </svg>
  )
}