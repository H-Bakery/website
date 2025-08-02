import React from 'react'
import { SvgIcon, SvgIconProps } from '@mui/material'

const Wappen: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 80 80">
      {/* Placeholder coat of arms/crest icon */}
      <circle
        cx="40"
        cy="40"
        r="35"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="40" cy="30" r="8" fill="currentColor" />
      <path
        d="M25 50 Q40 65 55 50 Q40 35 25 50"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="35" y="45" width="10" height="15" fill="currentColor" />
    </SvgIcon>
  )
}

export default Wappen
