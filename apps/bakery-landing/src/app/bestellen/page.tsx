'use client'

import Link from 'next/link'
import { Button, Container, Paper, Stack, Typography } from '@mui/material'
import Hero from '../../components/Hero'
import { OpenCartButton } from '../../components/order/OpenCartButton'
import { createPhoneLink, contactConfig } from '../../config/contact'
import { getCompactHoursSummary } from '../../utils/openingHours'

export default function BestellenPage() {
  return (
    <>
      <Hero title="Bestellen" />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Typography component="h2" variant="h5">
              Per WhatsApp vorbestellen
            </Typography>
            <Typography>
              Wählen Sie im Sortiment Ihre Backwaren und im Korb einen
              Abholtermin. Senden Sie uns dann die vorbereitete
              WhatsApp-Nachricht.
            </Typography>
            <Typography>
              Wir bestätigen Ihre Vorbestellung per WhatsApp. Erst dann ist sie
              fest.
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button
                component={Link}
                href="/products"
                variant="contained"
                sx={{ minHeight: 44 }}
              >
                Zum Sortiment
              </Button>
              <OpenCartButton />
            </Stack>
            <Typography>
              Telefonisch erreichen Sie uns {getCompactHoursSummary()}.
            </Typography>
            <Button
              href={createPhoneLink()}
              sx={{ minHeight: 44, alignSelf: 'flex-start' }}
            >
              Jetzt anrufen · {contactConfig.store.phone}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </>
  )
}
