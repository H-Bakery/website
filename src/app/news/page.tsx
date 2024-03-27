'use client'

import React from 'react'
import { Box } from '@mui/material'

import Base from '../../layouts/Base'
import News from '../../components/home/news'
import Hero from '../../components/Hero'

const Index: React.FC = () => (
  <Base>
    <Hero title="Neuigkeiten" />
    <Box mb={6}>
      <News />
    </Box>
  </Base>
)

export default Index
