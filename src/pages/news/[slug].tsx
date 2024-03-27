'use client'
import React from 'react'
import { Box, Container, Typography } from '@mui/material'

import Base from '../../layouts/BasePagesRouter'
import Hero from '../../components/Hero'
import { useRouter } from 'next/router'
import { NEWS } from '../../mocks/news'
import { NewsType } from '../../components/home/news/Card'
import { CollectionsBookmarkOutlined } from '@mui/icons-material'

const Index = ({ params }: { params: { slug: string } }) => {
  const router = useRouter()
  const { slug } = router.query

  const Default = {
    name: '',
    image: '',
    text: '',
  }

  const news: NewsType[] = NEWS.filter((item) => slug === item.slug)
  const currentNews = news[0] || Default

  return (
    <Base>
      <Container maxWidth="sm">
        <Hero title={currentNews.name} />
        <Box
          sx={{
            backgroundImage: `url(${currentNews.image})`,
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
          <Typography color="text.secondary">{currentNews.text}</Typography>
        </Box>
      </Container>
    </Base>
  )
}

// export async function getStaticProps({ ...ctx }) {
//   const { slug } = ctx.params

//   console.log('slug', slug)
//   return {
//     props: {},
//   }
// }

export async function generateStaticParams() {
  // const files = fs.readdirSync('projects')
  // const news: NewsType[] = NEWS.filter((item) => slug === item.slug)

  const paths = NEWS.map((file) => ({
    params: {
      slug: file.slug,
    },
  }))

  return {
    paths,
    fallback: false,
  }
}
export const dynamicParams = false

export default Index
