'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  fetchManagementProducts,
  type ManagementProduct,
} from '../../../lib/products'
import ProductListClient, { PRODUCTS_TITLE } from './ProductListClient'
import {
  ErrorState,
  LoadingState,
  PageLayout,
} from '../../../components/layout'
import { errorText } from '../partners/errorText'

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
        message: errorText(err, 'Die Produkte konnten nicht geladen werden.'),
      })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state.phase === 'loading') {
    return (
      <PageLayout title={PRODUCTS_TITLE}>
        <LoadingState label="Produkte werden geladen …" />
      </PageLayout>
    )
  }
  if (state.phase === 'error') {
    return (
      <PageLayout title={PRODUCTS_TITLE}>
        <ErrorState message={state.message} onRetry={load} />
      </PageLayout>
    )
  }
  return <ProductListClient products={state.products} />
}
