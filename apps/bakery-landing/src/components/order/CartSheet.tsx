'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { createPhoneLink } from '../../config/contact'
import { isOrderable } from '../../lib/order/order-config'
import {
  buildOrderMessage,
  orderLine,
  orderWhatsAppLink,
} from '../../lib/order/order-message'
import { pickupDays, type PickupClosures } from '../../lib/order/pickup-options'
import { CartItems, type CartLine } from './CartItems'
import { MessagePreview } from './MessagePreview'
import { useOrder } from './OrderContext'
import { PickupPicker } from './PickupPicker'

const calendar: PickupClosures | null = JSON.parse(
  process.env.LANDING_PICKUP_CALENDAR ?? 'null'
)
const STEPS = ['Was', 'Wann & wo', 'Senden'] as const
const stepTitles = [
  'Was möchten Sie abholen?',
  'Wann möchten Sie abholen?',
  'Angaben und Nachricht',
]
const actionSx = { minHeight: 44, textTransform: 'none' }

export function CartSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const order = useOrder()
  const [step, setStep] = useState(0)
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [followUp, setFollowUp] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const theme = useTheme()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    if (!open) return undefined
    const update = () => setNow(new Date())
    update()
    const clock = window.setInterval(update, 15_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(clock)
      window.removeEventListener('focus', update)
    }
  }, [open])

  useEffect(() => {
    if (open) heading.current?.focus()
  }, [open, step, followUp])

  if (!order) return null
  const { cart, products, notes, estimate } = order
  const quantities = new Map(
    cart.items.map(({ id, quantity }) => [id, quantity])
  )
  const lines: CartLine[] = []
  products.forEach((product) => {
    const quantity = quantities.get(product.id)
    if (quantity !== undefined)
      lines.push({ id: product.id, quantity, product })
  })
  for (const item of cart.items) {
    if (!products.has(item.id)) lines.push(item)
  }
  const available = lines.flatMap(({ id, product, quantity }) =>
    isOrderable(product) ? [{ ...product, quantity, note: notes.get(id) }] : []
  )
  const canOrder = available.length > 0 && available.length === lines.length
  const days = pickupDays(now, available, calendar ?? {})
  const validTime = Boolean(
    days.find(({ date }) => date === day)?.times.includes(time)
  )
  const message =
    canOrder && validTime && orderLine(cart.name) && order.reference
      ? buildOrderMessage({
          items: available,
          day,
          time,
          place: cart.pickupPlace,
          name: cart.name,
          note,
          estimate,
          reference: order.reference,
        })
      : ''

  const handOff = (event: MouseEvent<HTMLAnchorElement>) => {
    const fresh = new Date()
    if (
      !pickupDays(fresh, available, calendar ?? {})
        .find(({ date }) => date === day)
        ?.times.includes(time)
    ) {
      event.preventDefault()
      setNow(fresh)
      setStep(1)
      return
    }
    setFollowUp(true)
  }

  const resetDraft = () => {
    setFollowUp(false)
    setNote('')
    setDay('')
    setTime('')
    setStep(0)
  }

  const close = () => {
    setFollowUp(false)
    onClose()
  }

  const remove = (id: string) => {
    heading.current?.focus()
    order.changeQuantity(id, 'remove')
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      aria-labelledby="order-sheet-title"
      transitionDuration={reduceMotion ? 0 : undefined}
      sx={{
        zIndex: 10010,
        '& .MuiDialog-container': {
          alignItems: { xs: 'flex-end', md: 'stretch' },
          justifyContent: { xs: 'center', md: 'flex-end' },
        },
      }}
      PaperProps={{
        sx: {
          m: 0,
          width: { xs: '100%', md: 480 },
          maxWidth: '100%',
          maxHeight: { xs: '94dvh', md: '100dvh' },
          borderRadius: { xs: '18px 18px 0 0', md: 0 },
          pb: 'env(safe-area-inset-bottom, 0px)',
          '& :focus-visible, & .Mui-focusVisible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        },
      }}
    >
      <DialogTitle
        component="h2"
        id="order-sheet-title"
        sx={{
          p: '6px 12px 6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {followUp ? 'WhatsApp-Vorbestellung' : 'Ihr Korb'}
        <IconButton
          aria-label="Korb schließen"
          onClick={close}
          sx={{ width: 44, height: 44 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ px: 2, py: 1.5, scrollPadding: '8px', overflowX: 'hidden' }}
      >
        {followUp ? (
          <Stack spacing={2}>
            <Typography ref={heading} tabIndex={-1} component="h3" variant="h6">
              Nachricht abgeschickt?
            </Typography>
            <Typography>
              Wir bestätigen Ihre Vorbestellung per WhatsApp. Erst dann ist sie
              fest.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                order.clearCart()
                resetDraft()
                onClose()
              }}
              sx={actionSx}
            >
              Korb leeren
            </Button>
            <Button
              variant="outlined"
              onClick={() => setFollowUp(false)}
              sx={actionSx}
            >
              Zurück zum Korb
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <Box
              role="group"
              aria-label="Schritte der Vorbestellung"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0.5,
              }}
            >
              {STEPS.map((label, index) => (
                <Button
                  key={label}
                  onClick={() => setStep(index)}
                  aria-current={index === step ? 'step' : undefined}
                  variant={index === step ? 'contained' : 'text'}
                  sx={actionSx}
                >
                  {index + 1}. {label}
                </Button>
              ))}
            </Box>
            <Typography ref={heading} tabIndex={-1} component="h3" variant="h6">
              {stepTitles[step]}
            </Typography>
            {step === 0 && (
              <CartItems
                lines={lines}
                canOrder={canOrder}
                remove={remove}
                onContinue={() => setStep(1)}
                onClose={close}
              />
            )}
            {step === 1 && (
              <>
                <PickupPicker
                  days={days}
                  day={day}
                  time={time}
                  place={cart.pickupPlace}
                  calendarKnown={calendar !== null}
                  onDay={(value) => {
                    if (day !== value) {
                      setDay(value)
                      setTime('')
                    }
                  }}
                  onTime={setTime}
                />
                <Button
                  variant="contained"
                  disabled={!validTime}
                  onClick={() => setStep(2)}
                  sx={actionSx}
                >
                  Weiter zu Ihren Angaben
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <TextField
                  label="Name"
                  required
                  fullWidth
                  autoComplete={cart.rememberName ? 'name' : 'off'}
                  value={cart.name}
                  onChange={(event) => order.setName(event.target.value)}
                />
                <TextField
                  label="Anmerkung (optional)"
                  fullWidth
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={cart.rememberName}
                      onChange={(event) =>
                        order.setRememberName(event.target.checked)
                      }
                      sx={{ minWidth: 44, minHeight: 44 }}
                    />
                  }
                  label="Auf diesem Gerät merken"
                />
                {message ? (
                  <MessagePreview
                    message={message}
                    url={orderWhatsAppLink(message)}
                    onSend={handOff}
                    onFollowUp={() => setFollowUp(true)}
                  />
                ) : (
                  <Typography color="text.secondary">
                    {!canOrder
                      ? 'Bitte prüfen Sie zuerst die Artikel im Korb.'
                      : !validTime
                      ? 'Bitte wählen Sie einen verfügbaren Abholtermin.'
                      : 'Bitte geben Sie Ihren Namen ein.'}
                  </Typography>
                )}
              </>
            )}
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button href={createPhoneLink()} sx={actionSx}>
                Lieber anrufen
              </Button>
              <Button
                onClick={() => {
                  order.forget()
                  resetDraft()
                }}
                sx={actionSx}
              >
                Angaben vergessen
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}
