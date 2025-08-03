'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import Button from './button/Index'

interface NavigationButtonProps {
  href: string
  children: React.ReactNode
  [key: string]: any
}

const NavigationButton: React.FC<NavigationButtonProps> = ({
  href,
  children,
  ...props
}) => {
  const router = useRouter()

  const handleClick = () => {
    router.push(href)
  }

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  )
}

export default NavigationButton