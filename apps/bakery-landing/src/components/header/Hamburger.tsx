import React from 'react'
import { Box } from '@mui/material'

interface Props {
  open: boolean
  setOpen: (status: boolean) => void
}

/**
 * Die Striche sitzen in einem 36x28 großen Rahmen (`.bars`); der Knopf legt
 * ringsum Innenabstand an, damit die Trefferfläche mindestens 44x44 groß ist
 * (WCAG 2.5.5), ohne dass sich das Aussehen ändert.
 */
const Hamburger: React.FC<Props> = (props) => {
  const { open, setOpen } = props

  return (
    <Box
      component="button"
      type="button"
      aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
      aria-expanded={open}
      aria-controls="mobile-menu"
      onClick={() => setOpen(!open)}
      className={open ? 'open' : ''}
      sx={{
        boxSizing: 'border-box',
        minWidth: 44,
        minHeight: 44,
        p: '8px 4px',
        // Die Striche bleiben dort, wo sie ohne Innenabstand standen.
        mr: '-4px',
        border: 0,
        borderRadius: '8px',
        bgcolor: 'transparent',
        color: 'text.primary',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',

        '& .bars': {
          display: 'block',
          width: 36,
          height: 28,
          position: 'relative',
        },

        '& .bar': {
          display: 'block',
          position: 'absolute',
          height: 4,
          width: '100%',
          bgcolor: 'text.primary',
          borderRadius: '8px',
          opacity: 1,
          right: 0,
          transform: 'rotate(0deg)',
          transition: '320ms ease-in-out',

          '&:nth-of-type(1)': {
            top: 0,
            width: '100%',
          },

          '&:nth-of-type(2), &:nth-of-type(3)': {
            top: 12,
            width: '80%',
          },

          '&:nth-of-type(4)': {
            top: 24,
            width: '66%',
          },
        },
        '&.open .bar': {
          '&:nth-of-type(1)': {
            top: 18,
            width: '0%',
            right: '40%',
          },

          '&:nth-of-type(2)': {
            transform: 'rotate(45deg)',
            width: '100%',
            right: '-5%',
          },

          '&:nth-of-type(3)': {
            transform: 'rotate(-45deg)',
            width: '100%',
            right: '-5%',
          },

          '&:nth-of-type(4)': {
            top: 18,
            width: '0%',
            right: '40%',
          },
        },
      }}
    >
      <span className="bars" aria-hidden="true">
        <span className="bar"></span>
        <span className="bar"></span>
        <span className="bar"></span>
        <span className="bar"></span>
      </span>
    </Box>
  )
}

export default Hamburger
