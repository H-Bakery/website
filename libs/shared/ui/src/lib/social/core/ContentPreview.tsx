import React from 'react'
import { Box } from '@mui/material'

interface ContentPreviewProps {
  templateType: string
  content: any
  loading: boolean
  previewRef: React.RefObject<HTMLDivElement>
}

const ContentPreview: React.FC<ContentPreviewProps> = ({ templateType, content, loading, previewRef }) => {
  return <Box ref={previewRef}>Content Preview Placeholder</Box>
}

export default ContentPreview