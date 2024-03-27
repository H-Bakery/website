import React from 'react'
import { Box, BoxProps, Container, Grid } from '@mui/material'

import Card from './Card'
import { NEWS } from '../../../mocks/news'

interface Props extends BoxProps {
  header?: React.ReactNode
}

const News: React.FC<Props> = (props) => {
  const { header, sx } = props

  return (
    <Box sx={sx}>
      <Container>
        {header}
        <Grid container spacing={2}>
          {NEWS.map((item) => (
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
