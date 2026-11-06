'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, LinearProgress } from '@mui/material'
import {
  fetchManagementProducts,
  type ManagementProduct,
} from '../../../lib/products'
import ProductListClient from './ProductListClient'

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; products: ManagementProduct[] }
  | { phase: 'error'; message: string }

/**
 * Produktliste aus `GET /api/hq-products` (F4) - zur Laufzeit, damit neue
 * und auf Freigabe wartende Produkte sofort erscheinen (vorher beim Build
 * eingefroren).
 */
export default function ProductsPageClient() {
  const [state, setState] = useState<State>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      setState({ phase: 'ok', products: await fetchManagementProducts() })
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'Die Produkte konnten nicht geladen werden.',
      })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state.phase === 'loading') {
    return (
      <Box sx={{ py: 4 }}>
        <LinearProgress aria-label="Produkte werden geladen" />
      </Box>
    )
  }
  if (state.phase === 'error') {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={load}>
            Erneut versuchen
          </Button>
        }
      >
        {state.message}
      </Alert>
    )
  }
  return <ProductListClient products={state.products} />
}
