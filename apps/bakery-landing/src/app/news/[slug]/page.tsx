import React from 'react'
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material'
import {
  Home as HomeIcon,
  Newspaper as NewspaperIcon,
  Article as ArticleIcon,
} from '@mui/icons-material'
import Hero from '../../../components/Hero'
import { getNewsBySlug, getAllSlugs } from '../../../services/newsService'
import { notFound } from 'next/navigation'
import MarkdownDisplay from '../../../components/MarkdownDisplay'
import { Metadata } from 'next'
import { SITE_URL } from '../../../config/legal'

interface NewsArticlePageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({
  params,
}: NewsArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const news = getNewsBySlug(slug)

  if (!news) {
    return {
      title: 'Artikel nicht gefunden - Bäckerei Heusser',
    }
  }

  const title = `${news.name} - Bäckerei Heusser`
  const description = news.shortDescription
  const url = `${SITE_URL}/news/${slug}`
  const image = news.image?.startsWith('/')
    ? `${SITE_URL}${news.image}`
    : news.image || `${SITE_URL}/og-image.jpg`

  return {
    title,
    description,
    alternates: {
      canonical: `/news/${slug}`,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Bäckerei Heusser',
      type: 'article',
      locale: 'de_DE',
      images: [{ url: image, alt: news.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

/** Strip a leading markdown h1 ("# Title") – the Hero already renders the title. */
function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*#(?!#)[^\n]*\n+/, '')
}

export default async function NewsArticlePage({
  params,
}: NewsArticlePageProps) {
  const { slug } = await params

  const news = getNewsBySlug(slug)

  if (!news) {
    notFound()
  }

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Breadcrumb Navigation */}
        <Box sx={{ mb: 4 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              underline="hover"
              color="inherit"
              href="/"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Startseite
            </Link>
            <Link
              underline="hover"
              color="inherit"
              href="/news"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <NewspaperIcon sx={{ mr: 0.5 }} fontSize="small" />
              Neuigkeiten
            </Link>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'text.primary',
              }}
            >
              <ArticleIcon sx={{ mr: 0.5 }} fontSize="small" />
              {news.name}
            </Box>
          </Breadcrumbs>
        </Box>
      </Container>

      <Hero title={news.name} />

      <Container maxWidth="sm" sx={{ py: 4 }}>
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
          <MarkdownDisplay
            content={stripLeadingH1(news.content || news.text)}
          />
        </Box>
      </Container>
    </>
  )
}

export async function generateStaticParams() {
  const slugs = getAllSlugs()
  return slugs.map((slug) => ({
    slug,
  }))
}
