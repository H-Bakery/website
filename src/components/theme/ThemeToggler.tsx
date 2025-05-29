'use client'
import React from 'react'
import { IconButton, Tooltip } from '@mui/material'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { useTheme } from '../../context/ThemeContext'

interface ThemeTogglerProps {
  tooltip?: boolean
}

const ThemeToggler: React.FC<ThemeTogglerProps> = ({ tooltip = true }) => {
  const { mode, toggleTheme } = useTheme()

  const icon = mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />
  const tooltipTitle = mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
  
  const button = (
    <IconButton 
      onClick={toggleTheme} 
      color="inherit" 
      aria-label="toggle light/dark theme"
      size="medium"
    >
      {icon}
    </IconButton>
  )

  if (tooltip) {
    return (
      <Tooltip title={tooltipTitle} arrow>
        {button}
      </Tooltip>
    )
  }

  return button
}

export default ThemeToggler