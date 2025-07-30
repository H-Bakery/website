import React from 'react'
import { Box, Container, Typography } from '@mui/material'
import Base from '../../../layouts/Base'
import Hero from '../../../components/Hero'
import { getNewsBySlug, getAllSlugs } from '../../../services/newsService'
import { notFound } from 'next/navigation'
import MarkdownDisplay from '../../../components/MarkdownDisplay'

interface NewsArticlePageProps {
  params: {
    slug: string
  }
}

export default function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { slug } = params

  const news = getNewsBySlug(slug)

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
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
            {news.published} • {news.category}
          </Typography>
          <MarkdownDisplay content={news.content || news.text} />
        </Box>
      </Container>
    </Base>
  )
}

export async function generateStaticParams() {
  const slugs = getAllSlugs()
  return slugs.map((slug) => ({
    slug,
  }))
}
