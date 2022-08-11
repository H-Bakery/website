import React from 'react'
import { Box, Container } from "@mui/material"

import Base from "../layout/Base"
import Hero from "../components/Hero"
import Form from "../components/orders/Form"
import Button from "../components/button/Index"

const Index: React.FC = () => (
  <Base>
    <Hero title="Bestellen" />
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        mb: 6,
      }}
    >
      <Container maxWidth='sm'>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            mb: 6,
          }}
        >
          <Button sx={styles.button}>
            Anrufen
          </Button>
          <Button sx={styles.button}>
            WhatsApp
          </Button>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 6,
          }}>
          <Form />
        </Box>
      </Container>
    </Box>
  </Base>
)

const styles = {
  button: { mx: 1 }
}

export default Index;
