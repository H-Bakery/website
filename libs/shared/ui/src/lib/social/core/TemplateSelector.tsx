import React from 'react'
import { Box } from '@mui/material'

interface TemplateSelectorProps {
  value: string
  onChange: (value: string) => void
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ value, onChange }) => {
  return <Box>Template Selector Placeholder</Box>
}

export default TemplateSelector