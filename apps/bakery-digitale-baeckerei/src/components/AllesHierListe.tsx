'use client'
import React, { useId, useMemo } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { gruppiereEintraege } from './produktliste'
import { SEITLICH, TOUCH_TARGET, WENIGER_BEWEGUNG } from './theme'
import type { ListenEintrag } from './typen'

export const LISTE_LEER_TEXT = 'Hier liegt gerade nichts.'

export interface AllesHierListeProps {
  offen: boolean
  /** alle belegten Plätze des Blickpunkts; gleiche Produkte werden eine Zeile */
  eintraege: ListenEintrag[]
  blickpunktName: string
  /** bekommt den (ersten) Platz des gewählten Produkts */
  onSelect: (slot: string) => void
  onClose: () => void
}

/**
 * „Alles hier“: alle Produkte des Blickpunkts als Liste (Name, Einheit) - zum
 * Antippen statt im Bild zu suchen, und der Weg für Tastatur und Screenreader.
 * Unten als Sheet, auf dem Desktop und im Querformat am rechten Rand.
 */
export default function AllesHierListe({
  offen,
  eintraege,
  blickpunktName,
  onSelect,
  onClose,
}: AllesHierListeProps) {
  const titelId = useId()
  const wenigerBewegung = useMediaQuery(WENIGER_BEWEGUNG)
  const zeilen = useMemo(() => gruppiereEintraege(eintraege), [eintraege])

  return (
    <Dialog
      open={offen}
      onClose={onClose}
      aria-labelledby={titelId}
      transitionDuration={wenigerBewegung ? 0 : undefined}
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'flex-end',
          [SEITLICH]: { alignItems: 'stretch', justifyContent: 'flex-end' },
        },
        '& .MuiDialog-paper': {
          m: 0,
          width: '100%',
          maxWidth: 'none',
          maxHeight: '75dvh',
          borderRadius: '16px 16px 0 0',
          pb: 'env(safe-area-inset-bottom)',
          [SEITLICH]: {
            width: 'min(380px, 46vw)',
            maxHeight: 'none',
            borderRadius: 0,
            pb: 0,
            pr: 'env(safe-area-inset-right)',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pl: 2.5,
          pr: 1,
          pt: 1.5,
          pb: 0.5,
        }}
      >
        <Typography
          id={titelId}
          component="h2"
          sx={{ flex: 1, fontSize: '1.15rem', fontWeight: 700 }}
        >
          Alles hier: {blickpunktName}
        </Typography>
        <IconButton
          aria-label="Schließen"
          onClick={onClose}
          sx={{
            width: TOUCH_TARGET,
            height: TOUCH_TARGET,
            color: 'text.primary',
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain', pb: 1 }}>
        {zeilen.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            {LISTE_LEER_TEXT}
          </Typography>
        ) : (
          <List disablePadding aria-labelledby={titelId}>
            {zeilen.map(({ slot, produkt }) => (
              <ListItem key={produkt.id} disablePadding>
                <ListItemButton
                  component="button"
                  onClick={() => onSelect(slot)}
                  sx={{
                    width: '100%',
                    minHeight: 48,
                    px: 2.5,
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <ListItemText
                    primary={produkt.name}
                    secondary={produkt.einheit}
                    primaryTypographyProps={{
                      sx: { fontWeight: 600, overflowWrap: 'anywhere' },
                    }}
                    sx={{ my: 0.25 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Dialog>
  )
}
