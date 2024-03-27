import React from 'react'
import { Typography, Box } from '@mui/material'

interface Props {
  name?: string
  date?: string
  text?: string
}

const Card: React.FC<Props> = (props) => {
  const { name, date, text } = props

  return (
    <Box key={name}>
      <Box
        sx={{
          display: 'flex',
          mb: 1,
        }}
      >
        <Typography key={name} sx={{ mr: 1 / 2 }} variant="h5">
          {name}, {date}
        </Typography>
        <Typography variant="h6" sx={{ mt: 0 }}></Typography>
      </Box>
      <Typography color="text.secondary">{text}</Typography>
    </Box>
  )
}

export default Card
