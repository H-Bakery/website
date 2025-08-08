import React from 'react'
import { Button } from '@mui/material'

interface DownloadButtonProps {
  onClick: () => void
  loading: boolean
  disabled: boolean
  errorMessage?: string
  previewId?: string
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ onClick, loading, disabled, errorMessage }) => {
  return (
    <Button 
      onClick={onClick} 
      disabled={disabled || loading}
      variant="contained"
      fullWidth
    >
      {loading ? 'Lädt...' : 'Herunterladen'}
    </Button>
  )
}

export default DownloadButton