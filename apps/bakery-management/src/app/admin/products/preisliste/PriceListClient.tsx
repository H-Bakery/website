'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { Alert, AlertTitle, Box, Button, CircularProgress } from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Tune as TuneIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
} from '../../../../components/layout'
import {
  canExportPartnerPriceList,
  downloadPriceListCsv,
  fetchPriceList,
  type PriceListDoc,
  type PriceListOptions,
} from '../../../../lib/priceListApi'
import { useOptionalSession } from '../../../../lib/session'
import { errorText } from '../../partners/errorText'
import PriceListDialog from './PriceListDialog'
import PriceListSheet from './PriceListSheet'

const TITLE = 'Preisliste'
const PRINT_HIDDEN = { '@media print': { display: 'none' } } as const

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; doc: PriceListDoc }
  | { phase: 'error'; message: string }

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

/**
 * Vorschau der Preisliste mit „Drucken / als PDF speichern“ und CSV. Über
 * dem Blatt steht, was nur intern gilt und nie mitgedruckt wird: Produkte
 * mit offenem Preis, ausgeblendete Produkte, Hinweise zu den Daten.
 */
export default function PriceListClient({
  options,
}: {
  options: PriceListOptions
}) {
  const router = useRouter()
  const role = useOptionalSession()?.user?.role
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [csv, setCsv] = useState<
    { phase: 'idle' } | { phase: 'busy' } | { phase: 'error'; message: string }
  >({ phase: 'idle' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      setState({ phase: 'ok', doc: await fetchPriceList(options) })
    } catch (err) {
      setState({
        phase: 'error',
        message: errorText(err, 'Die Preisliste konnte nicht erstellt werden.'),
      })
    }
  }, [options])

  useEffect(() => {
    load()
  }, [load])

  const back = (
    <Button
      startIcon={<ArrowBackIcon />}
      color="inherit"
      onClick={() => router.push('/admin/products')}
    >
      Zu den Produkten
    </Button>
  )

  if (state.phase === 'loading') {
    return (
      <PageLayout title={TITLE} actions={back}>
        <LoadingState label="Preisliste wird erstellt …" />
      </PageLayout>
    )
  }
  if (state.phase === 'error') {
    return (
      <PageLayout title={TITLE} actions={back}>
        <ErrorState message={state.message} onRetry={load} />
      </PageLayout>
    )
  }

  const { doc } = state
  const empty = doc.status !== 'ok'

  const download = async () => {
    setCsv({ phase: 'busy' })
    try {
      await downloadPriceListCsv(options)
      setCsv({ phase: 'idle' })
    } catch (err) {
      setCsv({
        phase: 'error',
        message: errorText(err, 'Das CSV konnte nicht erstellt werden.'),
      })
    }
  }

  const subtitle = doc.partner
    ? `Für ${doc.partner.name} - ${plural(
        doc.counts.listed,
        'Produkt',
        'Produkte'
      )} aus dem Sortiment des Partners`
    : `${plural(doc.counts.listed, 'Produkt', 'Produkte')} in ${plural(
        doc.categories.length,
        'Kategorie',
        'Kategorien'
      )} - freigegebener Stand vom ${doc.generatedOnText}`

  return (
    <>
      <Box sx={PRINT_HIDDEN} data-testid="price-list-screen">
        <PageLayout
          title={TITLE}
          subtitle={subtitle}
          width="default"
          actions={
            <>
              {back}
              <Button
                variant="outlined"
                startIcon={<TuneIcon />}
                onClick={() => setDialogOpen(true)}
              >
                Optionen ändern
              </Button>
              <Button
                variant="outlined"
                startIcon={
                  csv.phase === 'busy' ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <DownloadIcon />
                  )
                }
                disabled={empty || csv.phase === 'busy'}
                onClick={download}
              >
                CSV (Excel)
              </Button>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                disabled={empty}
                onClick={() => window.print()}
              >
                Drucken / als PDF speichern
              </Button>
            </>
          }
        >
          {csv.phase === 'error' && (
            <Alert severity="error">{csv.message}</Alert>
          )}
          {doc.counts.noPrice > 0 && (
            <Alert severity="warning" data-testid="price-open">
              <AlertTitle>
                Preis offen: {plural(doc.counts.noPrice, 'Produkt', 'Produkte')}{' '}
                nicht auf der Liste
              </AlertTitle>
              Ohne Preis im Produktkatalog erscheint ein Produkt nicht auf der
              gedruckten Liste:{' '}
              {doc.omitted.noPrice
                .map((p) => `${p.name} (${p.categoryLabel})`)
                .join(', ')}
              .
            </Alert>
          )}
          {doc.counts.hiddenUnavailable > 0 && (
            <Alert severity="info" data-testid="hidden-unavailable">
              {plural(
                doc.counts.hiddenUnavailable,
                'nicht verfügbares Produkt ist',
                'nicht verfügbare Produkte sind'
              )}{' '}
              ausgeblendet („Optionen ändern“ zeigt sie gekennzeichnet).
            </Alert>
          )}
          {doc.partner && (
            <Alert severity="info" data-testid="partner-info">
              Sortiment aus{' '}
              {doc.partner.assortmentSource === 'templates'
                ? 'der Standard-Bestückung des Partners'
                : 'den Lieferungen der letzten Wochen (keine Standard-Bestückung hinterlegt)'}
              . Die Preise sind die des Produktkatalogs - eigene Partnerpreise,
              Rabatte oder ein Provisionssatz sind nicht hinterlegt.
            </Alert>
          )}
          {doc.dataWarnings.length > 0 && (
            <Alert severity="warning">
              {doc.dataWarnings.map((w) => w.message).join(' ')}
            </Alert>
          )}
          {empty && (
            <EmptyState
              title="Zu dieser Auswahl gibt es kein Produkt mit Preis."
              description="Andere Kategorien wählen oder nicht verfügbare Produkte einschließen."
            />
          )}
        </PageLayout>
      </Box>

      {!empty && (
        <Box sx={{ mt: 3, '@media print': { mt: 0 } }}>
          <PriceListSheet doc={doc} />
        </Box>
      )}

      {dialogOpen && (
        <PriceListDialog
          open
          onClose={() => setDialogOpen(false)}
          categories={doc.availableCategories}
          canPartner={!role || canExportPartnerPriceList(role)}
          initial={options}
        />
      )}
    </>
  )
}
