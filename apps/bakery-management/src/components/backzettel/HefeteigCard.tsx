'use client'

import React from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type {
  FillingNeed,
  Hefeteig,
  HefeteigDough,
} from '../../lib/backzettelApi'
import { formatGrams, formatNumber } from '../../lib/backzettelFormat'

const NUM = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const }

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="h5" component="div" fontWeight={700}>
        {value}
      </Typography>
    </Box>
  )
}

/** Chargen-Text; ohne Chargengröße kein geschätzter Wert. */
export function batchText(dough: HefeteigDough): string {
  if (dough.batches === null || !dough.batch_max_kg) {
    return 'Chargengröße nicht festgelegt'
  }
  return `${dough.batches} ${
    dough.batches === 1 ? 'Charge' : 'Chargen'
  } à max. ${formatNumber(dough.batch_max_kg)} kg`
}

function DoughBlock({ dough }: { dough: HefeteigDough }) {
  return (
    <Box data-testid={`dough-${dough.id}`}>
      <Typography variant="subtitle1" component="h3" fontWeight={700}>
        {dough.name}
      </Typography>
      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={6} sm={3}>
          <Figure label="Teigstücke" value={formatNumber(dough.pieces)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <Figure label="Teig gesamt" value={formatGrams(dough.dough_g)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Figure
            label="Chargen"
            value={dough.batches === null ? '–' : formatNumber(dough.batches)}
          />
          <Typography variant="caption" color="text.secondary">
            {batchText(dough)}
          </Typography>
        </Grid>
      </Grid>
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Abwiegeliste
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label={`Abwiegeliste ${dough.name}`}>
          <TableHead>
            <TableRow>
              <TableCell>Stückgewicht</TableCell>
              <TableCell sx={NUM}>Stück</TableCell>
              <TableCell>für</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dough.weighing.map((w) => (
              <TableRow key={w.piece_g}>
                <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {formatNumber(w.piece_g)} g
                </TableCell>
                <TableCell sx={NUM}>
                  <Typography component="span" fontWeight={700}>
                    {formatNumber(w.pieces)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {w.items
                    .map((i) =>
                      i.piecesPerProduct === 1
                        ? `${i.name} ${formatNumber(i.products)}`
                        : `${i.name} ${formatNumber(i.products)} × ${
                            i.piecesPerProduct
                          }`
                    )
                    .join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}

export function FillingBlock({ filling }: { filling: FillingNeed }) {
  return (
    <Box data-testid={`filling-${filling.id}`}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        spacing={1}
      >
        <Typography variant="subtitle1" component="h3" fontWeight={700}>
          {filling.name}
        </Typography>
        <Typography variant="h6" component="div" fontWeight={700}>
          {formatGrams(filling.grams)}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {filling.items
          .map(
            (i) =>
              `${i.name} ${formatNumber(i.pieces)} × ${
                i.filling_g === null ? '? g' : `${formatNumber(i.filling_g)} g`
              }`
          )
          .join(', ')}
      </Typography>
      {filling.missingFillingG && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Für mindestens einen Posten ist kein Füllungsgewicht hinterlegt – die
          Menge oben ist zu klein.
        </Alert>
      )}
      {filling.recipe ? (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">
            Rezept „{filling.recipe.title}“ auf{' '}
            {formatGrams(filling.recipe.grams)} (Faktor{' '}
            {formatNumber(filling.recipe.factor)}, Grundrezept{' '}
            {formatGrams(filling.recipe.batch_g)})
          </Typography>
          <Table size="small" aria-label={`Rezept ${filling.name}`}>
            <TableBody>
              {filling.recipe.ingredients.map((ing, idx) => (
                <TableRow key={`${ing.name}-${idx}`}>
                  <TableCell>{ing.name}</TableCell>
                  <TableCell sx={NUM}>
                    {ing.scaled_g === null ? (
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                      >
                        {ing.raw} (nicht skaliert)
                      </Typography>
                    ) : (
                      <strong>{formatGrams(ing.scaled_g)}</strong>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!filling.recipe.complete && (
            <Typography variant="caption" color="text.secondary">
              Rezept unvollständig – Zutaten ohne Grammangabe bitte nach Gefühl.
            </Typography>
          )}
        </Box>
      ) : filling.recipeMissing ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Kein Rezept hinterlegt.
        </Typography>
      ) : null}
    </Box>
  )
}

export interface HefeteigCardProps {
  hefeteig: Hefeteig | null
  fillings: FillingNeed[] | null
}

/**
 * „Hefeteig & Füllungen": Teigstücke, Teig je Teigsorte, Chargen,
 * Abwiegeliste und Füllungsbedarf mit skaliertem Rezept - genau so, wie der
 * Server sie gerechnet hat (Entwurf live, freigegeben eingefroren).
 */
export function HefeteigCard({ hefeteig, fillings }: HefeteigCardProps) {
  const doughs = hefeteig?.doughs ?? []
  const list = fillings ?? []
  if (doughs.length === 0 && list.length === 0) return null
  return (
    <Card variant="outlined" sx={{ mb: 2 }} data-testid="hefeteig-card">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Hefeteig &amp; Füllungen
        </Typography>
        <Stack spacing={3} divider={<Divider flexItem />}>
          {doughs.map((d) => (
            <DoughBlock key={d.id} dough={d} />
          ))}
          {list.length > 0 && (
            <Box>
              <Typography variant="subtitle1" component="h3" fontWeight={700}>
                Füllungen
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {list.map((f) => (
                  <FillingBlock key={f.id} filling={f} />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default HefeteigCard
