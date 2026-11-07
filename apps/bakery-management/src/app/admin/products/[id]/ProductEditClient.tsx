'use client'

import React, { useState } from 'react'
import { Alert, Chip } from '@mui/material'
import { apiClient } from '@bakery/shared/data-access'
import {
  CATEGORY_LABELS,
  PENDING_APPROVAL_LABEL,
  pendingApprovalHint,
  toManagementProduct,
  type ApiHqProduct,
  type ManagementProduct,
} from '../../../../lib/products'
import { useOptionalSession } from '../../../../lib/session'
import { EmptyState, PageLayout } from '../../../../components/layout'
import ProductForm, {
  STATUS_LABELS,
  productNameError,
  type ProductFormValues,
} from '../ProductForm'
import {
  PRICE_INPUT_ERROR,
  formatPriceInput,
  parsePriceInput,
} from '../priceInput'
import { errorText } from '../../partners/errorText'

const BACK = { href: '/admin/products', label: 'Alle Produkte' }

function valuesOf(product: ManagementProduct): ProductFormValues {
  return {
    name: product.name,
    category: product.categoryKey,
    price: formatPriceInput(product.price),
    status: product.status,
    image: product.rawImage,
    shortDescription: product.shortDescription,
    description: product.description,
  }
}

export default function ProductEditClient({
  productId,
  initialProduct,
}: {
  productId: string
  initialProduct?: ManagementProduct
}) {
  // F4: schreiben darf nur der Inhaber (B5). Ohne Sitzung (Specs) wie bisher.
  const role = useOptionalSession()?.user?.role
  const canEdit = !role || role === 'inhaber'
  const [current, setCurrent] = useState<ManagementProduct | undefined>(
    initialProduct
  )
  const [values, setValues] = useState<ProductFormValues | null>(
    initialProduct ? valuesOf(initialProduct) : null
  )
  const [priceError, setPriceError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  if (!initialProduct || !values) {
    return (
      <PageLayout title="Produkt nicht gefunden" back={BACK} width="narrow">
        <EmptyState
          title={`Unter der ID „${productId}“ gibt es kein Produkt.`}
          description="Vielleicht wurde es umbenannt - in der Produktliste suchen."
        />
      </PageLayout>
    )
  }

  const handleSave = async () => {
    if (!values.name.trim()) {
      setFeedback({
        message: 'Bitte einen Produktnamen angeben',
        severity: 'error',
      })
      return
    }
    if (productNameError(values.name)) {
      setFeedback({
        message: 'Nicht gespeichert: der Produktname ist zu lang.',
        severity: 'error',
      })
      return
    }
    const parsedPrice = parsePriceInput(values.price)
    if (parsedPrice == null) {
      setPriceError(PRICE_INPUT_ERROR)
      setFeedback({
        message: 'Nicht gespeichert: bitte den Preis prüfen.',
        severity: 'error',
      })
      return
    }
    setPriceError(null)
    setSaving(true)
    try {
      const res = await apiClient.put<ApiHqProduct>(
        `/api/hq-products/${encodeURIComponent(productId)}`,
        {
          name: values.name.trim(),
          category: values.category,
          price: parsedPrice,
          short_description: values.shortDescription.trim(),
          description: values.description,
          image: values.image.trim(),
          available: values.status !== 'unavailable',
          seasonal: values.status === 'seasonal',
        }
      )

      if (!res.success) {
        throw new Error(res.error || res.message || 'Speichern fehlgeschlagen')
      }

      // B5: die Antwort trägt `pendingApproval` (und oben `pending`) - eine
      // Änderung wartet auf Freigabe, bis die rollende hq-PR gemergt ist.
      const pending =
        res.data?.pendingApproval === true ||
        (res as { pending?: unknown }).pending === true
      if (res.data) {
        // Die PUT-Antwort trägt kein `approved`. Freigegeben ist, was vor
        // dem ersten wartenden Speichern galt: der bisherige freigegebene
        // Stand, sonst der Stand vor diesem Speichern.
        const approved =
          !pending || !current
            ? null
            : current.pendingApproval
            ? current.approved
            : {
                name: current.name,
                price: current.price,
                status: current.status,
              }
        setCurrent({
          ...toManagementProduct({ ...res.data, pendingApproval: pending }),
          approved,
        })
      }
      // Den gespeicherten Preis deutsch zurückschreiben („2.5“ → „2,50“).
      setValues((prev) =>
        prev ? { ...prev, price: formatPriceInput(parsedPrice) } : prev
      )
      setFeedback({
        message: pending
          ? 'Gespeichert - die Änderung wartet auf Freigabe.'
          : 'Produkt erfolgreich gespeichert',
        severity: 'success',
      })
    } catch (err) {
      setFeedback({
        message: errorText(err, 'Fehler beim Speichern'),
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const categoryLabel =
    CATEGORY_LABELS[current?.categoryKey ?? ''] || current?.category || ''

  return (
    <PageLayout
      title={current?.name || initialProduct.name}
      subtitle={
        canEdit
          ? `${categoryLabel} · Produkt bearbeiten`
          : `${categoryLabel} · nur zum Ansehen`
      }
      back={BACK}
      width="narrow"
      status={
        <>
          <Chip
            size="small"
            variant="outlined"
            label={STATUS_LABELS[current?.status ?? 'active']}
          />
          {current?.pendingApproval && (
            <Chip
              label={PENDING_APPROVAL_LABEL}
              color="info"
              variant="outlined"
              size="small"
            />
          )}
        </>
      }
    >
      {current?.pendingApproval && (
        <Alert severity="info">{pendingApprovalHint(current)}</Alert>
      )}
      {!canEdit && (
        <Alert severity="info">
          Produkte ändert nur der Inhaber. Die Angaben hier sind nur zum
          Ansehen.
        </Alert>
      )}

      <ProductForm
        idPrefix="product"
        values={values}
        onChange={(next) => {
          setValues(next)
          setFeedback(null)
          if (priceError && next.price !== values.price) setPriceError(null)
        }}
        feedback={feedback}
        onDismissFeedback={() => setFeedback(null)}
        readOnly={!canEdit}
        priceError={priceError}
        submitLabel="Speichern"
        busyLabel="Speichern …"
        busy={saving}
        onSubmit={handleSave}
      />
    </PageLayout>
  )
}
