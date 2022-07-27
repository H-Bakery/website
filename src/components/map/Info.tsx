import { Box, Typography } from '@mui/material'
import React from 'react'

interface Props {
  label: string
  value: string
}

const Info: React.FC<Props> = (props) => {
  const { label, value } = props

  return (
    <Box sx={styles.info}>
      <Typography
        fontWeight='bold'
        variant='body2'
        color='text.disabled'
      >
        {label}
      </Typography>
      <Typography>{value}</Typography>
    </Box>
  )
}

const styles = {
  info: {
    mb: 1
  }
}

export default Info