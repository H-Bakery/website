import { Base } from "../layout/Base";
import { Box, Button, Container, Grid, Typography } from "@mui/material";

const Index = () => (
  <Base>
    <Box sx={{ py: 6 }}>
      <Container>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
          }}
        >
          <Typography variant="h1">Über Uns</Typography>
        </Box>
      </Container>
    </Box>
  </Base>
);

export default Index;
