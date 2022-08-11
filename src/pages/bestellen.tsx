import { Base } from "../layout/Base"
import { Box, Button, Container } from "@mui/material"
import Hero from "../components/Hero"
import Form from "../components/orders/Form"

const Index = () => (
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
          <Button
            variant='contained'
            sx={styles.button}
          >
            Anrufen
          </Button>
          <Button
            variant='contained'
            sx={styles.button}
          >
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
  button: {
    mx: 2,
  }
}

export default Index;
