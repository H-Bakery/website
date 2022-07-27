import { Box, Typography } from '@mui/material'
import React from 'react'

interface Props {
  label: string
  value: string
}

const Info: React.FC<Props> = (props) => {
  const { label, value } = props

  return (
    <Box>
      <Typography>{label}</Typography>
      <Typography>{value}</Typography>
    </Box>
  )
}

export default Info