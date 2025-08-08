import React from 'react'
import { Box } from '@mui/material'

interface SimpleContentFormProps {
  templateType: string
  values: any
  onChange: (field: string, value: string) => void
}

const SimpleContentForm: React.FC<SimpleContentFormProps> = ({ templateType, values, onChange }) => {
  return <Box>Content Form Placeholder</Box>
}

export default SimpleContentForm