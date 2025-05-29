// website/src/layouts/Base.tsx
'use client'
import { Box } from '@mui/material'
import { Header } from '../../components/header' // Import Header
import Footer from '../../components/footer/Index' // Import Footer

interface Props {
  children: React.ReactNode
}

const BaseLayout: React.FC<Props> = ({ children }) => (
  <Box
    sx={{
      background:
        'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4',
    }}
  >
    <Header />
    <Box sx={{ minHeight: 'calc(100vh - 332px)' }}>{children}</Box>
    {/* <Cart /> */}
    <Footer />
  </Box>
)

export default BaseLayout
