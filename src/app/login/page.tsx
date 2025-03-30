'use client'
import React, { useState } from 'react'
import { Container } from '@mui/material'
import { useRouter } from 'next/navigation'

import Hero from '../../components/Hero'
import Base from '../../layouts/Base'
import Input from '../../components/Input'
import Button from '../../components/button/Index'

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
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const router = useRouter()

  const login = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:5000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Login failed')
      }

      // Store token in localStorage
      localStorage.setItem('token', result.token)

      // Redirect to dashboard or home
      router.push('/dashboard')
    } catch (error: any) {
      setError(error.message || 'Failed to login. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const register = async () => {
    setLoading(true)
    setError('')

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
      setError(error.message || 'Failed to register. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Base>
      <Hero title="Anmelden" />
      <Container maxWidth="sm">
        {error && (
          <div
            style={{ color: 'red', marginBottom: '20px', textAlign: 'center' }}
          >
            {error}
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
            onClick={login}
            disabled={loading || !data.username || !data.password}
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </Button>
          <Button
            onClick={register}
            disabled={loading || !data.username || !data.password}
            variant="outlined"
          >
            {loading ? 'Registrieren...' : 'Registrieren'}
          </Button>
        </div>
      </Container>
    </Base>
  )
}

export default Login
