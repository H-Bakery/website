import React from 'react'
import { Box } from '@mui/material'

import Base from '../../layouts/Base'
import News from '../../components/home/news'
import Hero from '../../components/Hero'
import { getAllNews } from '../../services/newsService'

export default async function Index() {
  const news = getAllNews()
  
  return (
    <Base>
      <Hero title="Neuigkeiten" />
      <Box mb={6}>
        <News news={news} />
      </Box>
    </Base>
  )
}
