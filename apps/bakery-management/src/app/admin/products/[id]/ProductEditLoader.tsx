'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  fetchManagementProduct,
  type ManagementProduct,
} from '../../../../lib/products'
import ProductEditClient from './ProductEditClient'
import {
  ErrorState,
  LoadingState,
  PageLayout,
} from '../../../../components/layout'
import { errorText } from '../../partners/errorText'

const BACK = { href: '/admin/products', label: 'Alle Produkte' }

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
        message: errorText(err, 'Das Produkt konnte nicht geladen werden.'),
      })
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  if (state.phase === 'loading') {
    return (
      <PageLayout title="Produkt" back={BACK} width="narrow">
        <LoadingState label="Produkt wird geladen …" />
      </PageLayout>
    )
  }
  if (state.phase === 'error') {
    return (
      <PageLayout title="Produkt" back={BACK} width="narrow">
        <ErrorState message={state.message} onRetry={load} />
      </PageLayout>
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
