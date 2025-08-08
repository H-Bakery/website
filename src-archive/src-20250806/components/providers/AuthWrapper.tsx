'use client'
import React from 'react'
import { AuthProvider } from '../../context/AuthContext'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  return <AuthProvider>{children}</AuthProvider>
}
