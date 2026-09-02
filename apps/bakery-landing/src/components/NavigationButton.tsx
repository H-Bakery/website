'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import Button from './button/Index'

interface NavigationButtonProps {
  href: string
  children: React.ReactNode
  /** Icon vor dem Text */
  icon?: React.ReactNode
  /** Markiert die aktuelle Route (CSS-Klasse `active`) */
  isActive?: boolean
  /** Externe Ziele öffnen als Link in neuem Tab statt über den Router */
  isExternal?: boolean
  className?: string
  [key: string]: any
}

const NavigationButton: React.FC<NavigationButtonProps> = ({
  href,
  children,
  icon,
  isActive = false,
  isExternal = false,
  className,
  ...props
}) => {
  const router = useRouter()

  const classes =
    [className, isActive ? 'active' : undefined].filter(Boolean).join(' ') ||
    undefined

  if (isExternal) {
    return (
      <Button
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={icon}
        className={classes}
        {...props}
      >
        {children}
      </Button>
    )
  }

  return (
    <Button
      onClick={() => router.push(href)}
      startIcon={icon}
      className={classes}
      {...props}
    >
      {children}
    </Button>
  )
}

export default NavigationButton
