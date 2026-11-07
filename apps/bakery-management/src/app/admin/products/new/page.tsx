'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Snackbar } from '@mui/material'
import { apiClient } from '@bakery/shared/data-access'
import { PageLayout } from '../../../../components/layout'
import ProductForm, { type ProductFormValues } from '../ProductForm'
import { PRICE_INPUT_ERROR, parsePriceInput } from '../priceInput'

const EMPTY: ProductFormValues = {
  name: '',
  category: 'brot',
  price: '',
  status: 'active',
  image: '',
  shortDescription: '',
  description: '',
}

export default function NewProductPage() {
  const router = useRouter()
  const [values, setValues] = useState<ProductFormValues>(EMPTY)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  const handleCreate = async () => {
    if (!values.name.trim()) {
      setFeedback({
        message: 'Bitte einen Produktnamen angeben',
        severity: 'error',
      })
      return
    }
    const parsedPrice = parsePriceInput(values.price)
    if (parsedPrice == null) {
      setPriceError(PRICE_INPUT_ERROR)
      setFeedback({ message: PRICE_INPUT_ERROR, severity: 'error' })
      return
    }
    setPriceError(null)
    setSaving(true)
    try {
      const res = await apiClient.post<{ id: string }>('/api/hq-products', {
        name: values.name.trim(),
        category: values.category,
        price: parsedPrice,
        image: values.image.trim(),
        short_description: values.shortDescription.trim(),
        description: values.description,
        available: values.status !== 'unavailable',
        seasonal: values.status === 'seasonal',
      })

      if (!res.success) {
        throw new Error(res.error || res.message || 'Anlegen fehlgeschlagen')
      }

      setFeedback({ message: 'Produkt angelegt', severity: 'success' })
      router.refresh()
      const newId = res.data?.id
      router.push(newId ? `/admin/products/${newId}` : '/admin/products')
    } catch (err) {
      setFeedback({
        message: err instanceof Error ? err.message : 'Fehler beim Anlegen',
        severity: 'error',
      })
      setSaving(false)
    }
  }

  return (
    <PageLayout
      title="Neues Produkt"
      subtitle="ID und Nummer vergibt die App aus dem Namen."
      back={{ href: '/admin/products', label: 'Alle Produkte' }}
      width="narrow"
    >
      <ProductForm
        idPrefix="new-product"
        values={values}
        onChange={(next) => {
          setValues(next)
          if (priceError && next.price !== values.price) setPriceError(null)
        }}
        priceError={priceError}
        submitLabel="Produkt anlegen"
        busyLabel="Wird angelegt …"
        busy={saving}
        onSubmit={handleCreate}
      />

      <Snackbar
        open={feedback !== null}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {feedback ? (
          <Alert
            severity={feedback.severity}
            onClose={() => setFeedback(null)}
            variant="filled"
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </PageLayout>
  )
}
