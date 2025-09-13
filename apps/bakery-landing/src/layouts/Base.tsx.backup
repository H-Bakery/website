'use client'
import { Box } from '@mui/material'
import { Header } from '@bakery/shared/ui'
import { Footer } from '@bakery/shared/ui'

interface Props {
  children: React.ReactNode
}

const Base: React.FC<Props> = ({ children }) => (
  <Box
    sx={{
      background:
        'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <Header />
    <Box component="main" sx={{ flex: 1, minHeight: 'calc(100vh - 332px)' }}>
      {children}
    </Box>
    <Footer />
  </Box>
)

export default Base
