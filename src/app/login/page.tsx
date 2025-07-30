'use client'
import React, { useState, useEffect } from 'react'
import { Container } from '@mui/material'
import { useRouter } from 'next/navigation'

import Hero from '../../components/Hero'
import Base from '../../layouts/Base'
import Input from '../../components/Input'
import Button from '../../components/button/Index'
import { useAuth } from '../../context/AuthContext'

interface Data {
  username: string
  password: string
}

const DEFAULT = {
  username: '',
  password: '',
}

const Login: React.FC = () => {
  const [data, setData] = useState<Data>(DEFAULT)
  const [localError, setLocalError] = useState<string>('')
  const { login, loading, error, isAuthenticated } = useAuth()
  const router = useRouter()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/admin')
    }
  }, [isAuthenticated, router])

  const handleLogin = async () => {
    setLocalError('')

    try {
      await login(data.username, data.password)
      // Redirect to admin dashboard on successful login
      router.push('/admin')
    } catch (error: any) {
      setLocalError(error.message || 'Failed to login. Please try again.')
    }
  }

  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationError, setRegistrationError] = useState('')

  const register = async () => {
    setRegistrationLoading(true)
    setRegistrationError('')

    try {
      const response = await fetch('http://localhost:5000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      // Show success message and prompt to login
      alert('Registration successful! You can now log in.')

      // Clear form
      setData(DEFAULT)
    } catch (error: any) {
      setRegistrationError(error.message || 'Failed to register. Please try again.')
    } finally {
      setRegistrationLoading(false)
    }
  }

  return (
    <Base>
      <Hero title="Anmelden" />
      <Container maxWidth="sm">
        {(error || localError || registrationError) && (
          <div
            style={{ color: 'red', marginBottom: '20px', textAlign: 'center' }}
          >
            {error || localError || registrationError}
          </div>
        )}
        <Input
          name="username"
          placeholder="Benutzername"
          label="Benutzername"
          onChange={(e) => setData({ ...data, username: e.target.value })}
          value={data.username}
          disabled={loading}
        />
        <Input
          name="password"
          type="password"
          placeholder="Passwort"
          label="Passwort"
          onChange={(e) => setData({ ...data, password: e.target.value })}
          value={data.password}
          disabled={loading}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <Button
            onClick={handleLogin}
            disabled={loading || registrationLoading || !data.username || !data.password}
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </Button>
          <Button
            onClick={register}
            disabled={loading || registrationLoading || !data.username || !data.password}
            variant="outlined"
          >
            {registrationLoading ? 'Registrieren...' : 'Registrieren'}
          </Button>
        </div>
      </Container>
    </Base>
  )
}

export default Login
