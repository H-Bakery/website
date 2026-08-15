'use client'
import React, { useEffect, useState } from 'react'
import { Box, Button, Typography, Link } from '@mui/material'
import MapIcon from '@mui/icons-material/Map'

export const MAP_CONSENT_KEY = 'osm-map-consent'

interface MapConsentProps {
  children: React.ReactNode
}

/**
 * Zwei-Klick-Lösung für die OpenStreetMap-Einbindung (DSGVO / § 25 TDDDG):
 * Kartenkacheln werden erst nach ausdrücklicher Zustimmung geladen.
 * Die Entscheidung wird im Local Storage gespeichert.
 */
export function MapConsent({ children }: MapConsentProps) {
  const [consented, setConsented] = useState<boolean>(false)

  useEffect(() => {
    try {
      setConsented(window.localStorage.getItem(MAP_CONSENT_KEY) === 'true')
    } catch {
      /* Local Storage nicht verfügbar → jedes Mal fragen */
    }
  }, [])

  const accept = () => {
    try {
      window.localStorage.setItem(MAP_CONSENT_KEY, 'true')
    } catch {
      /* ignore */
    }
    setConsented(true)
  }

  if (consented) return <>{children}</>

  return (
    <Box
      role="region"
      aria-label="Kartenhinweis"
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 2,
        p: 3,
        bgcolor: '#F5EDE4',
        color: '#3B2B28',
      }}
    >
      <MapIcon sx={{ fontSize: 48, color: '#928168' }} />
      <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
        Karte anzeigen
      </Typography>
      <Typography variant="body2" sx={{ maxWidth: 420 }}>
        Mit dem Laden der Karte wird eine Verbindung zu OpenStreetMap
        (OpenStreetMap Foundation, Vereinigtes Königreich) hergestellt und dabei
        Ihre IP-Adresse übertragen. Weitere Informationen finden Sie in unserer{' '}
        <Link href="/datenschutz" color="inherit" sx={{ fontWeight: 600 }}>
          Datenschutzerklärung
        </Link>
        .
      </Typography>
      <Button variant="contained" onClick={accept} startIcon={<MapIcon />}>
        Karte laden
      </Button>
      <Typography variant="caption" sx={{ color: '#928168' }}>
        Ihre Entscheidung wird lokal in Ihrem Browser gespeichert.
      </Typography>
    </Box>
  )
}
