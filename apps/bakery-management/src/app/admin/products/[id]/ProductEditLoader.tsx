'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Container, LinearProgress } from '@mui/material'
import {
  fetchManagementProduct,
  type ManagementProduct,
} from '../../../../lib/products'
import ProductEditClient from './ProductEditClient'

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; product: ManagementProduct | null }
  | { phase: 'error'; message: string }

/**
 * Lädt ein Produkt über `GET /api/hq-products/:id` (F4) - den Stand im
 * Schreib-Worktree, also auch ein eben angelegtes oder ein auf Freigabe
 * wartendes. 404 → „nicht gefunden“ im Formular.
 */
export default function ProductEditLoader({
  productId,
}: {
  productId: string
}) {
  const [state, setState] = useState<State>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      setState({
        phase: 'ok',
        product: await fetchManagementProduct(productId),
      })
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'Das Produkt konnte nicht geladen werden.',
      })
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  if (state.phase === 'loading') {
    return (
      <Box sx={{ py: 4 }}>
        <LinearProgress aria-label="Produkt wird geladen" />
      </Box>
    )
  }
  if (state.phase === 'error') {
    return (
      <Container sx={{ mt: 4 }}>
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
      </Container>
    )
  }
  return (
    <ProductEditClient
      key={state.product?.id ?? 'missing'}
      productId={productId}
      initialProduct={state.product ?? undefined}
    />
  )
}
