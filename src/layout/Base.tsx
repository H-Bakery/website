import { Box } from "@mui/material"

import { Meta } from "./Meta"
import { AppConfig } from "../utils/AppConfig"
import { Header } from "../components/header"
import Footer from "../components/footer/Index"

interface Props {
  children: React.ReactNode
}

const Base: React.FC<Props> = ({children}) => (
  <Box 
    sx={{
      background: 'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4'
    }}  
  >
    <Meta title={AppConfig.title} description={AppConfig.description} />
    <Header />
    <Box sx={{ minHeight: 'calc(100vh - 332px)'}}>
      {children}
    </Box>
    <Footer />
  </Box>
)

export default Base
