'use client'
import React from 'react'
import { Container } from '@mui/material'

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
  const [data, setData] = React.useState<Data>(DEFAULT)

  const submit = () => {
    console.log('Login Form Data submitted: ', data)
  }

  return (
    <Base>
      <Hero title="Anmelden" />
      <Container maxWidth="sm">
        <Input
          name="username"
          placeholder="Benutzername"
          label="Benutzername"
          onChange={(e) => setData({ ...data, username: e.target.value })}
          value={data.username}
        />
        <Input
          name="password"
          type="password"
          placeholder="Passwort"
          label="Passwort"
          onChange={(e) => setData({ ...data, password: e.target.value })}
          value={data.password}
        />
        <Button onClick={submit}>Anmelden</Button>
      </Container>
    </Base>
  )
}

export default Login
