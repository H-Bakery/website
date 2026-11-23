'use client'

import { Box, Button } from '@mui/material'
import { useEffect, useRef } from 'react'
import { ORDER_CONFIG } from '../../lib/order/order-config'

export function CartBar({
  count,
  estimate,
  onOpen,
}: {
  count: number
  estimate: string
  onOpen: () => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = bar.current
    if (!element) return undefined
    const root = document.documentElement
    const reserveSpace = () =>
      root.style.setProperty('--order-bar-height', `${element.offsetHeight}px`)
    reserveSpace()
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(reserveSpace)
    resize?.observe(element)
    window.addEventListener('resize', reserveSpace)
    let frame = 0
    const ensureVisible = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const target = document.activeElement
        if (
          !target ||
          target === document.body ||
          element.contains(target) ||
          target.closest('[role="dialog"]')
        )
          return
        const field = target.getBoundingClientRect()
        const bottomEdge = element.getBoundingClientRect().top
        if (field.bottom > bottomEdge && field.top < window.innerHeight) {
          window.scrollBy({
            top: Math.ceil(field.bottom - bottomEdge + 12),
            behavior: 'instant' as ScrollBehavior,
          })
        }
      })
    }
    document.addEventListener('focusin', ensureVisible)
    ensureVisible()
    return () => {
      resize?.disconnect()
      window.removeEventListener('resize', reserveSpace)
      root.style.removeProperty('--order-bar-height')
      document.removeEventListener('focusin', ensureVisible)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <Box
      ref={bar}
      sx={{
        position: 'fixed',
        zIndex: 1100,
        bottom: 0,
        insetInline: 0,
        px: 2,
        pt: 1,
        pb: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        backgroundColor: 'background.paper',
        boxShadow: '0 -2px 12px rgba(50, 30, 14, .14)',
        display: 'flex',
        justifyContent: 'center',
        '@keyframes cart-count': { '50%': { transform: 'scale(1.18)' } },
      }}
    >
      <Button
        variant="contained"
        onClick={onOpen}
        aria-haspopup="dialog"
        sx={{
          minHeight: 44,
          width: '100%',
          maxWidth: 480,
          textTransform: 'none',
          gap: 0.5,
        }}
      >
        <Box
          component="span"
          key={count}
          sx={{
            display: 'inline-block',
            '@media (prefers-reduced-motion: no-preference)': {
              animation: 'cart-count 180ms ease-out',
            },
          }}
        >
          {count}
        </Box>
        Artikel{ORDER_CONFIG.showEstimate ? ` · ${estimate}` : ''} → Korb
      </Button>
    </Box>
  )
}
