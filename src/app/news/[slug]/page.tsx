// @ts-nocheck

import React from 'react'
import { Box, Container, Typography } from '@mui/material'
import Base from '../../../layouts/Base'
import Hero from '../../../components/Hero'
import { NEWS } from '../../../mocks/news'
import { notFound } from 'next/navigation'

export default function NewsArticlePage({ params }: any) {
  const { slug } = params

  const news = NEWS.find((item) => item.slug === slug)

  if (!news) {
    notFound()
  }

  return (
    <Base>
      <Container maxWidth="sm">
        <Hero title={news.name} />
        <Box
          sx={{
            backgroundImage: `url(${news.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: 320,
            width: '100%',
            borderRadius: '8px',
            boxShadow: 1,
            mb: 2,
          }}
        />
        <Box mb={6}>
          <Typography color="text.secondary">{news.text}</Typography>
        </Box>
      </Container>
    </Base>
  )
}

export async function generateStaticParams() {
  return NEWS.map((article) => ({
    slug: article.slug,
  }))
}
