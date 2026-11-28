import React from 'react'
import { Box, Button, Modal as MuiModal } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface Props {
  open: boolean
  setOpen: (status: boolean) => void
  children: React.ReactNode
}

/**
 * Das mobile Menü als modaler Dialog. Solange er offen ist, blendet MUI den
 * Rest der Seite für Hilfstechnik aus (`aria-hidden`) - auch das X des
 * Hamburgers in der Kopfzeile. Deshalb hat der Dialog seinen eigenen Knopf
 * „Menü schließen“; Escape und ein Tipp neben das Menü schließen ihn auch.
 */
const Modal: React.FC<Props> = (props) => {
  const { open, setOpen, children } = props

  return (
    <MuiModal
      open={open}
      onClose={() => setOpen(false)}
      sx={{
        position: 'fixed',
        zIndex: '1000',
        bgcolor: 'rgba(255,255,255,0.66)',
        backdropFilter: 'blur(8px)',
        p: 2,
        pt: { xs: 10, md: 13 },
        '& .MuiBackdrop-root': {
          bgcolor: 'transparent',
        },
      }}
    >
      <Box
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Hauptmenü"
        sx={{
          outline: 'none',
          display: { xs: 'flex', md: 'none' },
          flexDirection: 'column',
        }}
      >
        {children}
        <Button
          onClick={() => setOpen(false)}
          startIcon={<CloseIcon />}
          sx={{
            alignSelf: 'flex-end',
            minHeight: 44,
            mt: 3,
            px: 2,
            // Text bündig rechts mit den Menüpunkten, Trefferfläche bleibt.
            mr: -2,
            color: 'text.primary',
          }}
        >
          Menü schließen
        </Button>
      </Box>
    </MuiModal>
  )
}

export default Modal
