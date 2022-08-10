import { Base } from "../layout/Base";
import { Box, Button, Container, Grid, Typography } from "@mui/material";
import Hero from "../components/Hero";

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
      <Container>
        <Button>Anrufen</Button>
        <Button>WhatsApp</Button>
      </Container>
    </Box>
  </Base>
);

export default Index;
