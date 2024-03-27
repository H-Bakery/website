'use client'
import React from 'react'
import Base from '../../layouts/Base'
import { Box, Container, Typography } from '@mui/material'
import Hero from '../../components/Hero'

const Imprint: React.FC = () => (
  <Base>
    <Hero title="Impressum" />
    <Box sx={{ py: 6 }}>
      <Container maxWidth="sm">
        <Box>
          <Typography variant="h5">
            Angaben gem&auml;&szlig; &sect; 5 TMG
          </Typography>
          <Typography mb={2} color="text.secondary">
            Bäckerei Heusser
            <br />
            Eckstraße 3
            <br />
            66424 Homburg/Kirrberg
          </Typography>

          <Typography mb={2} color="text.secondary">
            <strong>Vertreten durch:</strong>
            <br />
            Karl-Heinz Heußer
          </Typography>

          <Typography variant="h5">Kontakt</Typography>
          <Typography mb={2} color="text.secondary">
            Telefon: 06841 2229
            <br />
            Handy: 01522 66 2 12 36
            <br />
            E-Mail: baeckerei@heusserk.de
          </Typography>

          <Typography variant="h5">Umsatzsteuer-ID</Typography>
          <Typography mb={2} color="text.secondary">
            Umsatzsteuer-Identifikationsnummer gem&auml;&szlig; &sect; 27 a
            Umsatzsteuergesetz:
            <br />
            DE999999999
          </Typography>

          <Typography variant="h5">Redaktionell verantwortlich</Typography>
          <Typography mb={2} color="text.secondary">
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
)

export default Imprint
