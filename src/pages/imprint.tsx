import { Base } from "../layout/Base";
import { Box, Button, Container, Grid, Typography } from "@mui/material";

const Imprint = () => (
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
          <Typography variant="h1">Impressum</Typography>
        </Box>
        <Box>
          <Typography variant="h3">
            Angaben gem&auml;&szlig; &sect; 5 TMG
          </Typography>
          <Typography variant="body1">
            Bäckerei Heusser
            <br />
            Eckstraße 3
            <br />
            66424 Homburg/Kirrberg
          </Typography>

          <Typography variant="body1">
            <strong>Vertreten durch:</strong>
            <br />
            Karl-Heinz Heußer
          </Typography>

          <Typography variant="h3">Kontakt</Typography>
          <Typography variant="body1">
            Telefon: 06841 2229
            <br />
            Handy: 01522 66 2 12 36
            <br />
            E-Mail: baeckerei@heusserk.de
          </Typography>

          <Typography variant="h3">Umsatzsteuer-ID</Typography>
          <Typography variant="body1">
            Umsatzsteuer-Identifikationsnummer gem&auml;&szlig; &sect; 27 a
            Umsatzsteuergesetz:
            <br />
            DE999999999
          </Typography>

          <Typography variant="h3">Redaktionell verantwortlich</Typography>
          <Typography variant="body1">
            Sebastian Heußer
            <br />
            Collingstraße 104
            <br />
            66424 Homburg/Kirrberg
          </Typography>
        </Box>
      </Container>
    </Box>
  </Base>
);

export default Imprint;
