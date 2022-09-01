import React from 'react'
import { Box, BoxProps, Container, Grid, Typography } from '@mui/material'

import Card from '../home/news/Card'
import { NEWS } from '../../mocks/news'
import { Fade } from 'react-slideshow-image'

interface Props extends BoxProps {
  header?: React.ReactNode
}

const News: React.FC<Props> = (props) => {
  const { header, sx } = props

  return (
    <Box
      sx={{
        ...sx,
        '& .news-card': {
          p: 2,
          '& .MuiTypography-root': {
            fontSize: 24,
          },
          '& .MuiChip-root': {
            p: 1,
            height: 'auto',
            borderRadius: '50px',
          },
          '& .MuiChip-label': {
            fontSize: 20,
          },
        },
      }}
    >
      <Typography sx={{ mb: 1 }} variant="h4">
        {header}
      </Typography>
      <Fade arrows={false}>
        {NEWS.map((item) => (
          <Card {...item} key={item.id} />
        ))}
      </Fade>
    </Box>
  )
}

export default News
