'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { Button, ButtonProps } from '@mui/material'

interface NavigationButtonProps extends Omit<ButtonProps, 'href'> {
  href: string
  label: string
  icon?: React.ReactNode
  isActive?: boolean
  isExternal?: boolean
  size?: 'small' | 'medium' | 'large'
  variant?: 'text' | 'outlined' | 'contained' | 'outline'
  className?: string
  children?: React.ReactNode
}

const NavigationButton: React.FC<NavigationButtonProps> = ({
  href,
  label,
  icon,
  isActive,
  isExternal,
  size = 'medium',
  variant = 'contained',
  className = '',
  children,
  disabled,
  ...props
}) => {
  const router = useRouter()

  const handleClick = () => {
    if (disabled) return

    if (isExternal) {
      window.open(href, '_blank', 'noopener noreferrer')
    } else {
      router.push(href)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }

  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'btn-small'
      case 'large':
        return 'btn-large'
      default:
        return ''
    }
  }

  const getVariantClass = () => {
    switch (variant) {
      case 'outline':
        return 'btn-outline'
      default:
        return ''
    }
  }

  const buttonClasses = [
    className,
    isActive ? 'active' : '',
    getSizeClass(),
    getVariantClass(),
  ]
    .filter(Boolean)
    .join(' ')

  if (isExternal) {
    return (
      <Button
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        size={
          size === 'large' ? 'large' : size === 'small' ? 'small' : 'medium'
        }
        variant={variant === 'outline' ? 'outlined' : variant}
        className={buttonClasses}
        startIcon={icon}
        disabled={disabled}
        {...props}
      >
        {children || label}
      </Button>
    )
  }

  return (
    <Button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      size={size === 'large' ? 'large' : size === 'small' ? 'small' : 'medium'}
      variant={variant === 'outline' ? 'outlined' : variant}
      className={buttonClasses}
      startIcon={icon}
      disabled={disabled}
      {...props}
    >
      {children || label}
    </Button>
  )
}

export default NavigationButton
