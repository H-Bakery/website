'use client'
import React from 'react'
import { useAuth } from '../../context/AuthContext'

export default function AdminTestPage() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div>Loading auth...</div>
  }

  if (!isAuthenticated) {
    return <div>Not authenticated - should redirect to login</div>
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Admin Test Page</h1>
      <p>Authenticated as: {user?.username}</p>
      <p>User ID: {user?.id}</p>
      <p>Loading: {loading.toString()}</p>
      <p>Authenticated: {isAuthenticated.toString()}</p>
    </div>
  )
}
