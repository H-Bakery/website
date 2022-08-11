import React from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { useRouter } from 'next/router'

export interface NewsType {
  id: number
  name: string
  category: string
  image: string
  text: string
  shortDescription: string
  slug: string
}

const Card: React.FC<NewsType> = (props) => {
  const {id, name, category, image, shortDescription, slug } = props
  const router = useRouter()

  return (
    <Box key={id} sx={styles.card} onClick={() => router.push(`/news/${slug}`)}>
      <Box sx={{
        ...styles.image,
        backgroundImage: `url(${image})`
      }} className='image'>
      </Box>
      <Typography sx={styles.name}>
        {name}
      </Typography>
      <Typography variant='body2' color='text.secondary'>
        {shortDescription}
      </Typography>
      <Box sx={styles.footer}>
        <Chip size='small' label={category} />
      </Box>
    </Box>
  )
}

const styles = {
  card: {
    bgcolor: 'background.paper',
    borderRadius: '8px',
    boxShadow: 1,
    display: 'flex',
    flexDirection: 'column',
    p: 1,
    transition: 'all ease-in-out 200ms',
    cursor: 'pointer',
    height: '100%',

    '&:hover': {
      transform: 'translateY(-4px)',
      bgcolor: 'grey.300',
      '& .image': {
        bgcolor: 'grey.50'
      }
    }
  },
  image: {
    mb: 1,
    minHeight: 160,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: 'grey.200',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: '8px',
    transition: 'all ease-in-out 300ms',
    '& img': {
      maxHeight: 120
    }
  },
  name: {
    fontWeight: 'bold',
  },
  footer: {
    mt: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
}

export default Card