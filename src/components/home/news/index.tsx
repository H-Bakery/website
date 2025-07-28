import React from 'react'
import { Box, BoxProps, Container, Grid } from '@mui/material'

import Card from './Card'
import { NewsItem } from '../../../services/newsService'

interface Props extends BoxProps {
  header?: React.ReactNode
  news: NewsItem[]
}

const News: React.FC<Props> = (props) => {
  const { header, sx, news } = props

  return (
    <Box sx={sx}>
      <Container>
        {header}
        <Grid container spacing={2}>
          {news.map((item) => (
            <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
              <Card {...item} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default News
