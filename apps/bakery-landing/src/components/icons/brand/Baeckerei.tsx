import React from 'react'
import { SvgIcon, SvgIconProps } from '@mui/material'

const Baeckerei: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 200 60">
      {/* Placeholder bakery text logo */}
      <text
        x="100"
        y="35"
        textAnchor="middle"
        fontSize="24"
        fontFamily="serif"
        fill="currentColor"
      >
        Bäckerei
      </text>
      <text
        x="100"
        y="50"
        textAnchor="middle"
        fontSize="16"
        fontFamily="serif"
        fill="currentColor"
      >
        Heusser
      </text>
    </SvgIcon>
  )
}

export default Baeckerei
