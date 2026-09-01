'use client'

/**
 * @fileoverview Kasse — /kasse. The real order form.
 * @module @bakery/shop/feature-cart/checkout-page
 *
 * Submits a genuine `POST /api/orders` and routes to the confirmation page.
 * There is deliberately no WhatsApp or telephone ordering path here — that
 * channel lives on the landing site only.
 *
 * Renders no Header/Footer: the app layout owns the shop chrome.
 */

import React from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined'

import { useCart } from '@bakery/shared/contexts'
import { buildOrderItems, submitOrder } from '@bakery/shared/data-access'
import { BRAND_FACTS, CROSS_CONTAMINATION_NOTE } from '@bakery/shared/utils'
import { ShopPrice } from '@bakery/shop/feature-catalog'

import { grossTotal } from './order-totals'
import {
  ALL_PICKUP_SLOTS,
  PICKUP_LEAD_MINUTES,
  formatGermanDate,
  formatOpeningWindow,
  openingWindowFor,
  pickupTimeSlots,
  toIsoDate,
  weekdayNameFor,
} from './pickup'
import {
  CHECKOUT_FORM_STORAGE_KEY,
  CheckoutFieldErrors,
  CheckoutFormValues,
  EMPTY_CHECKOUT_FORM,
  type LeadTimeLimit,
  firstInvalidField,
  leadTimeLimitFor,
  minPickupIsoDate,
  restoreCheckoutForm,
  serializeCheckoutForm,
  validateCheckout,
} from './checkout-validation'

/** DOM ids double as the contract's data-testids — one string per field, no drift. */
const FIELD_IDS: Record<keyof CheckoutFormValues, string> = {
  customerName: 'customer-name',
  phone: 'customer-phone',
  email: 'customer-email',
  pickupDate: 'pickup-date',
  pickupTime: 'pickup-time',
  notes: 'order-notes',
}

const GENERIC_SUBMIT_ERROR = 'Bestellung konnte nicht übermittelt werden.'

/**
 * Nach so langer Zeit hört die Kasse auf zu warten. Im Zug mit einem Balken
 * Empfang blieb der Button vorher unbegrenzt im Ladezustand stehen.
 */
const SUBMIT_TIMEOUT_MS = 15000

/**
 * Bewusst offen formuliert: `submitOrder()` nimmt (noch) kein `AbortSignal`,
 * der Controller unten bricht deshalb nur unser Warten ab, nicht den laufenden
 * Request. Die Bestellung *kann* also doch angekommen sein — dann wäre
 * „Ihre Bestellung wurde nicht aufgegeben" gelogen.
 */
const SUBMIT_TIMEOUT_ERROR =
  'Die Verbindung ist zu langsam — wir haben keine Bestätigung bekommen. Bitte prüfen Sie Ihre Verbindung und schicken Sie die Bestellung noch einmal ab.'

/** "Now", captured once on mount — never during render, or hydration breaks. */
interface ClientNow {
  iso: string
  minutes: number
  /** Derselbe Zeitpunkt als `Date`, für die Vorbestellfrist. */
  stamp: Date
}

/* -------------------------------------------------------------------------- */
/* Formular über einen Seitenwechsel retten                                    */
/* -------------------------------------------------------------------------- */
/*
 * Wer auf „Ändern" tippt, landet im Warenkorb — und kam bisher mit leerem
 * Formular zurück. Auf dem Telefon bedeutet das: Name, Telefonnummer, Datum und
 * Uhrzeit noch einmal tippen. Die Rohdaten liegen im `sessionStorage`; sie
 * werden nirgends geloggt und nach der abgeschickten Bestellung gelöscht.
 */

function readStoredForm(todayIso: string): CheckoutFormValues | null {
  try {
    return restoreCheckoutForm(
      window.sessionStorage.getItem(CHECKOUT_FORM_STORAGE_KEY),
      todayIso
    )
  } catch {
    // Privater Modus o. Ä. — dann gibt es eben keine Wiederherstellung.
    return null
  }
}

function writeStoredForm(values: CheckoutFormValues): void {
  try {
    window.sessionStorage.setItem(
      CHECKOUT_FORM_STORAGE_KEY,
      serializeCheckoutForm(values)
    )
  } catch {
    /* Speicher voll oder gesperrt — das Formular funktioniert trotzdem. */
  }
}

function clearStoredForm(): void {
  try {
    window.sessionStorage.removeItem(CHECKOUT_FORM_STORAGE_KEY)
  } catch {
    /* siehe oben */
  }
}

export const CheckoutPage: React.FC = () => {
  const { items, summary, isLoading, clearCart } = useCart()
  const router = useRouter()

  const [values, setValues] =
    React.useState<CheckoutFormValues>(EMPTY_CHECKOUT_FORM)
  const [errors, setErrors] = React.useState<CheckoutFieldErrors>({})
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  /** Set between a successful submit and the route change, so the cleared cart does not flash the empty state. */
  const [isRedirecting, setIsRedirecting] = React.useState(false)
  const [now, setNow] = React.useState<ClientNow | null>(null)
  /** Erst nach dem Lesen des `sessionStorage` darf zurückgeschrieben werden. */
  const [isRestored, setIsRestored] = React.useState(false)

  React.useEffect(() => {
    const stamp = new Date()
    const iso = toIsoDate(stamp)
    setNow({
      iso,
      minutes: stamp.getHours() * 60 + stamp.getMinutes(),
      stamp,
    })

    const stored = readStoredForm(iso)
    if (stored) setValues(stored)
    setIsRestored(true)
  }, [])

  React.useEffect(() => {
    if (!isRestored) return
    writeStoredForm(values)
  }, [values, isRestored])

  /**
   * Datensparsamkeit: ohne Warenkorb gibt es keine Bestellung, für die diese
   * Kontaktdaten noch gebraucht würden.
   */
  React.useEffect(() => {
    if (!isRestored || isLoading || isRedirecting) return
    if (items.length === 0) clearStoredForm()
  }, [isRestored, isLoading, isRedirecting, items.length])

  const todayIso = now?.iso ?? ''
  const total = grossTotal(summary)

  /**
   * Vorbestellfrist des Warenkorbs. Ganze Torten und Kuchen werden auf
   * Bestellung gebacken — die Kasse darf sie nicht für „in einer Stunde"
   * annehmen.
   */
  const leadTime: LeadTimeLimit | null = React.useMemo(
    () => (now ? leadTimeLimitFor(items, now.stamp) : null),
    [items, now]
  )

  /** Frühestes Datum, das der native Datepicker überhaupt anbieten darf. */
  const minPickupDate = minPickupIsoDate(todayIso, leadTime)

  /** Slots really available on the chosen day; same-day keeps a Vorlaufzeit. */
  const slotsForDate = React.useMemo(() => {
    if (!values.pickupDate) return []
    const earliest =
      now && values.pickupDate === now.iso
        ? now.minutes + PICKUP_LEAD_MINUTES
        : 0
    return pickupTimeSlots(values.pickupDate, earliest)
  }, [values.pickupDate, now])

  /**
   * Die Auswahl zeigt genau das, was die Prüfung anschließend auch annimmt.
   *
   * Vorher stand hier ein Rückfall auf {@link ALL_PICKUP_SLOTS}, sobald die
   * Liste leer war. Das traf zwei Fälle, die nichts miteinander zu tun haben:
   *
   * - **Noch kein Datum gewählt.** Dann wurde der ganze Tagesbogen 05:30–13:00
   *   angeboten, obwohl am Sonntag erst um 08:00 geöffnet ist. Jetzt: nichts,
   *   dazu der Hinweis, zuerst das Datum zu wählen.
   * - **Heute ist nichts mehr frei.** Der Rückfall bot dann Uhrzeiten an, die
   *   die Prüfung direkt danach ablehnte. Jetzt: ebenfalls nichts, mit
   *   Begründung im Hilfetext.
   *
   * Nur wenn das *Datum* selbst schon durchfällt (Ruhetag, Unsinn im Feld),
   * bleibt die vollständige Liste stehen: die Uhrzeit wird dann gar nicht mehr
   * geprüft, und ein leeres Auswahlfeld wäre eine Sackgasse ohne Nutzen.
   */
  const timeOptions = React.useMemo<ReadonlyArray<string>>(() => {
    if (!values.pickupDate) return []
    if (openingWindowFor(values.pickupDate)) return slotsForDate
    return ALL_PICKUP_SLOTS
  }, [values.pickupDate, slotsForDate])

  const pickupTimeHint = React.useMemo(() => {
    if (!values.pickupDate) return 'Bitte zuerst ein Abholdatum wählen.'
    const window = openingWindowFor(values.pickupDate)
    if (!window) return `${weekdayNameFor(values.pickupDate)} ist Ruhetag.`
    if (slotsForDate.length === 0) {
      return 'Für diesen Tag ist keine Abholung mehr möglich.'
    }
    return `Geöffnet: ${formatOpeningWindow(window)}`
  }, [values.pickupDate, slotsForDate])

  const updateField = (field: keyof CheckoutFormValues, value: string) => {
    setValues((previous) => {
      // A new date invalidates the chosen slot — a Sunday 08:00 is not a Tuesday 06:00.
      if (field === 'pickupDate') {
        return { ...previous, pickupDate: value, pickupTime: '' }
      }
      return { ...previous, [field]: value }
    })
    setErrors((previous) => {
      const next = { ...previous }
      delete next[field]
      if (field === 'pickupDate') delete next.pickupTime
      return next
    })
  }

  const handleBlur = (field: keyof CheckoutFormValues) => () => {
    const found = validateCheckout(values, todayIso, slotsForDate, leadTime)
    setErrors((previous) => ({ ...previous, [field]: found[field] }))
  }

  const fieldProps = (field: keyof CheckoutFormValues, hint?: string) => ({
    id: FIELD_IDS[field],
    name: FIELD_IDS[field],
    value: values[field],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => updateField(field, event.target.value),
    onBlur: handleBlur(field),
    error: Boolean(errors[field]),
    helperText: errors[field] ?? hint ?? ' ',
    fullWidth: true,
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const found = validateCheckout(values, todayIso, slotsForDate, leadTime)
    setErrors(found)

    const firstBad = firstInvalidField(found)
    if (firstBad) {
      document.getElementById(FIELD_IDS[firstBad])?.focus()
      return
    }

    setIsSubmitting(true)

    // Die Uhr für den Abbruch. `submitOrder()` kennt noch kein `AbortSignal`;
    // sobald es eines nimmt, wird `controller.signal` einfach durchgereicht und
    // der Request wirklich abgebrochen statt nur nicht mehr abgewartet.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS)

    try {
      const request = submitOrder({
        customerName: values.customerName.trim(),
        phone: values.phone.trim(),
        email: values.email.trim() || undefined,
        pickupDate: values.pickupDate,
        pickupTime: values.pickupTime,
        notes: values.notes.trim() || undefined,
        items: buildOrderItems(items),
        total,
      })
      // Verliert der Request das Rennen, will sein Fehler trotzdem behandelt
      // sein — sonst steht eine unhandled rejection in der Konsole.
      request.catch(() => undefined)

      const order = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            'abort',
            () => reject(new Error(SUBMIT_TIMEOUT_ERROR)),
            { once: true }
          )
        }),
      ])

      const orderId = String(order?.id ?? '').trim()
      if (!orderId) {
        // The order may well exist; we just cannot link to it. Keep the basket.
        throw new Error(
          'Die Bestellung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.'
        )
      }

      // Only now is it safe to empty the basket — a failed request must not lose it.
      setIsRedirecting(true)
      // Die Bestellung liegt beim Bäcker; die Kontaktdaten müssen hier nicht
      // länger herumliegen.
      clearStoredForm()
      clearCart()
      router.push(`/bestellung/${encodeURIComponent(orderId)}`)
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : GENERIC_SUBMIT_ERROR
      )
      setIsSubmitting(false)
    } finally {
      clearTimeout(timer)
    }
  }

  const isEmpty = items.length === 0

  return (
    <Box
      data-testid="checkout-page"
      sx={{ py: { xs: 3, md: 5 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        <Typography variant="h1" component="h1">
          Kasse
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Noch zwei Angaben, dann liegt Ihre Bestellung bereit. Bezahlt wird im
          Laden.
        </Typography>

        {isLoading || isRedirecting ? (
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              mt: 4,
              p: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <CircularProgress size={28} />
            <Typography color="text.secondary">
              {isRedirecting
                ? 'Bestellung wird übermittelt …'
                : 'Warenkorb wird geladen …'}
            </Typography>
          </Paper>
        ) : isEmpty ? (
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              mt: 4,
              p: { xs: 4, md: 6 },
              textAlign: 'center',
            }}
          >
            <ShoppingBagOutlinedIcon
              sx={{ fontSize: 56, color: 'primary.light', mb: 1.5 }}
            />
            <Typography variant="h4" component="p" gutterBottom>
              Ihr Warenkorb ist leer
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ maxWidth: 440, mx: 'auto', mb: 3 }}
            >
              Ohne etwas darin können wir nichts zurücklegen. Suchen Sie sich
              zuerst etwas aus.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="center"
            >
              <Button
                component={NextLink}
                href="/products"
                variant="contained"
                size="large"
              >
                Weiter einkaufen
              </Button>
              <Button component={NextLink} href="/cart" variant="outlined">
                Zum Warenkorb
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Grid
            container
            spacing={{ xs: 2, md: 4 }}
            alignItems="flex-start"
            sx={{ mt: { xs: 1, md: 2 } }}
          >
            {/*
              Auf dem Telefon stand die Übersicht bisher *unter* dem
              Absenden-Button: bestätigt wurde ein Betrag, den man nie gesehen
              hatte. Die `order`-Werte drehen die beiden Spalten auf schmalen
              Geräten um; ab `md` steht die Übersicht wieder rechts.
            */}
            <Grid item xs={12} md={7} sx={{ order: { xs: 2, md: 1 } }}>
              <Paper
                variant="outlined"
                sx={{ borderRadius: 2, p: { xs: 2, md: 3 } }}
              >
                <Box component="form" onSubmit={handleSubmit} noValidate>
                  <Typography variant="h4" component="h2">
                    Wer holt ab?
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, mb: 2 }}
                  >
                    Wir melden uns nur, wenn es zu Ihrer Bestellung eine
                    Rückfrage gibt.
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        {...fieldProps('customerName')}
                        label="Name"
                        required
                        autoComplete="name"
                        placeholder="Vor- und Nachname"
                        inputProps={{
                          'data-testid': FIELD_IDS.customerName,
                          maxLength: 100,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        {...fieldProps('phone')}
                        label="Telefon"
                        required
                        type="tel"
                        autoComplete="tel"
                        placeholder="06841 123456"
                        inputProps={{ 'data-testid': FIELD_IDS.phone }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        {...fieldProps('email', 'Optional')}
                        label="E-Mail"
                        type="email"
                        autoComplete="email"
                        placeholder="name@beispiel.de"
                        inputProps={{ 'data-testid': FIELD_IDS.email }}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="h4" component="h2">
                    Wann passt es Ihnen?
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, mb: 2 }}
                  >
                    Di–Fr 05:30–13:30 Uhr, Sa 05:30–12:30 Uhr, So 08:00–11:00
                    Uhr. Montag ist Ruhetag.
                  </Typography>

                  {leadTime && (
                    <Alert
                      data-testid="checkout-lead-time"
                      severity="info"
                      sx={{ mb: 2 }}
                    >
                      {leadTime.reason} Frühester Termin:{' '}
                      {formatGermanDate(leadTime.earliestIso)}.
                    </Alert>
                  )}

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        {...fieldProps('pickupDate')}
                        label="Abholdatum"
                        required
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{
                          'data-testid': FIELD_IDS.pickupDate,
                          min: minPickupDate || undefined,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        {...fieldProps('pickupTime', pickupTimeHint)}
                        label="Abholzeit"
                        required
                        select
                        SelectProps={{ native: true }}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ 'data-testid': FIELD_IDS.pickupTime }}
                      >
                        <option value="">Uhrzeit wählen</option>
                        {timeOptions.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot} Uhr
                          </option>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        {...fieldProps(
                          'notes',
                          'Zum Beispiel: Brot bitte ungeschnitten.'
                        )}
                        label="Anmerkungen"
                        multiline
                        rows={3}
                        inputProps={{
                          'data-testid': FIELD_IDS.notes,
                          maxLength: 500,
                        }}
                      />
                    </Grid>
                  </Grid>

                  {submitError && (
                    <Alert
                      data-testid="checkout-error"
                      severity="error"
                      sx={{ mt: 1, mb: 2 }}
                    >
                      {submitError}
                    </Alert>
                  )}

                  {/*
                    Der Betrag noch einmal unmittelbar über dem Button — auf dem
                    Telefon ist die Übersicht oben längst weggescrollt. Ab `md`
                    steht sie sichtbar daneben, dort wäre das doppelt.
                  */}
                  <Box
                    sx={{
                      display: { xs: 'flex', md: 'none' },
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 2,
                      mt: 1,
                      mb: 1.5,
                      pt: 1.5,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" component="p">
                        Gesamt
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        inkl. MwSt. · Zahlung bei Abholung
                      </Typography>
                    </Box>
                    <ShopPrice value={total} size="lg" />
                  </Box>

                  <Button
                    type="submit"
                    data-testid="submit-order"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={isSubmitting}
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : undefined
                    }
                    sx={{ mt: 1 }}
                  >
                    Bestellung abschicken
                  </Button>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1.5 }}
                  >
                    Sie geben eine unverbindliche Vorbestellung auf. Online wird
                    nichts abgebucht.
                  </Typography>
                  {/*
                    Allergene, direkt am Bestellknopf. Nur positive Aussagen:
                    51 der 103 Gebäcke haben noch keine geprüfte Angabe, und ein
                    Schweigen darf sich nie wie eine Entwarnung lesen.
                  */}
                  <Typography
                    data-testid="checkout-allergen-note"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    Allergene stehen bei jedem Gebäck auf seiner Seite. Fehlt
                    dort noch eine geprüfte Angabe, sagen wir sie Ihnen vorher
                    am Telefon: {BRAND_FACTS.phone}. {CROSS_CONTAMINATION_NOTE}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid
              item
              xs={12}
              md={5}
              sx={{ width: '100%', order: { xs: 1, md: 2 } }}
            >
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  p: { xs: 2, md: 2.5 },
                  position: { md: 'sticky' },
                  top: { md: 24 },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Typography variant="h4" component="h2">
                    Ihre Bestellung
                  </Typography>
                  <Button
                    component={NextLink}
                    href="/cart"
                    size="small"
                    variant="text"
                  >
                    Ändern
                  </Button>
                </Box>

                <Stack
                  component="ul"
                  spacing={1.25}
                  sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none' }}
                >
                  {items.map((item) => (
                    <Box
                      key={item.id}
                      component="li"
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                      }}
                    >
                      <Typography variant="body2">
                        <Box
                          component="span"
                          sx={{ fontWeight: 700, mr: 0.75 }}
                        >
                          {item.quantity}×
                        </Box>
                        {item.name}
                      </Typography>
                      <ShopPrice
                        value={item.price * item.quantity}
                        size="sm"
                        tone="plain"
                        component="span"
                      />
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 2,
                  }}
                >
                  <Typography variant="h4" component="p">
                    Gesamt
                  </Typography>
                  <ShopPrice value={total} size="lg" testId="checkout-total" />
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  inkl. MwSt. · Zahlung bei Abholung
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    </Box>
  )
}

export default CheckoutPage
