import React from 'react'
import { Box, Container, Typography } from '@mui/material'

import Base from '../../layout/Base'
import Hero from '../../components/Hero'
import { useRouter } from 'next/router'
import { NEWS } from '../../mocks/news'
import { NewsType } from '../../components/home/news/Card'

const Index: React.FC = () => { 
  const router = useRouter()
  const { slug } = router.query

  const  Default = {
    name: '',
    image: '',
    text: '',
  }

  const news: NewsType[] = NEWS.filter((item) => slug === item.slug)
  const currentNews = news[0] || Default

  return (  
    <Base>
      <Container maxWidth='sm'>
        <Hero title={currentNews.name} />
        <Box sx={{
          backgroundImage: `url(${currentNews.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          height: 320,
          width: '100%',
          borderRadius: '8px',
          boxShadow: 1,
          mb: 2
        }} />
        <Box mb={6}>
          <Typography color='text.secondary'>
            {currentNews.text}
          </Typography>
        </Box>
      </Container>
    </Base>
  )
}

export default Index
