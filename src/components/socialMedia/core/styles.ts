import { alpha, Theme } from '@mui/material'

// Shared styles for the social media content creator
export const getStyles = (theme: Theme) => ({
  container: {
    py: 4
  },
  paper: {
    p: 3,
    borderRadius: 2,
    bgcolor: 'background.paper',
    boxShadow: theme.shadows[1]
  },
  titleWithIcon: {
    display: 'flex',
    alignItems: 'center',
    mb: 2,
    color: 'primary.main',
    '& .MuiSvgIcon-root': {
      mr: 1
    }
  },
  roundedInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2
    }
  },
  iconButton: {
    borderRadius: '50%',
    p: 1.2,
    boxShadow: 1
  },
  preview: {
    width: 280,
    height: 280,
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)'
  },
  previewContent: {
    width: 1080,
    height: 1080,
    transformOrigin: '0 0',
    transform: 'scale(0.25)',
    position: 'absolute',
    top: 0,
    left: 0
  },
  textPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    padding: '7% 15% 7% 8%', // Extra space for Wappen
    minHeight: '67%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    zIndex: 3
  },
  downloadButton: {
    py: 2,
    borderRadius: 2,
    boxShadow: 2,
    fontSize: '1.1rem',
    fontFamily: "'Averia Serif Libre', serif"
  },
  highlight: {
    bgcolor: alpha(theme.palette.primary.main, 0.08),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
  }
})