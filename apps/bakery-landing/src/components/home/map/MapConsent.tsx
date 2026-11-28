'use client'
import React, { useEffect, useState } from 'react'
import { Box, Button, Typography, Link } from '@mui/material'
import type { ResponsiveStyleValue } from '@mui/system'
import MapIcon from '@mui/icons-material/Map'

export const MAP_CONSENT_KEY = 'osm-map-consent'

interface MapConsentProps {
  children: React.ReactNode
  /**
   * Höhe der geladenen Karte - Leaflet braucht eine feste Höhe. Der Hinweis
   * davor ist nur *mindestens* so hoch und wächst mit seinem Inhalt, damit auf
   * schmalen Bildschirmen weder Knopf noch Datenschutzhinweis abgeschnitten
   * werden. Standard: die Höhe des umgebenden Rahmens.
   */
  height?: ResponsiveStyleValue<number | string>
}

/**
 * Zwei-Klick-Lösung für die OpenStreetMap-Einbindung (DSGVO / § 25 TDDDG):
 * Kartenkacheln werden erst nach ausdrücklicher Zustimmung geladen.
 * Die Entscheidung wird im Local Storage gespeichert.
 */
export function MapConsent({ children, height = '100%' }: MapConsentProps) {
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

  if (consented) {
    return <Box sx={{ height, width: '100%' }}>{children}</Box>
  }

  return (
    <Box
      role="region"
      aria-label="Kartenhinweis"
      sx={{
        minHeight: height,
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
      <MapIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
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
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Ihre Entscheidung wird lokal in Ihrem Browser gespeichert.
      </Typography>
    </Box>
  )
}
