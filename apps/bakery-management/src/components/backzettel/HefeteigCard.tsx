'use client'

import React from 'react'
import {
  Alert,
  Box,
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
import {
  fillingGramsText,
  fillingOpenNote,
  formatKnown,
  weighingItemsText,
  weighingPiecesText,
  formatNumber,
  formatGrams,
  hefeteigDoughText,
  hefeteigPiecesText,
  ingredientAmount,
  litersHint,
  litersFigure,
  recipeHeading,
  recipeIncompleteNote,
} from '../../lib/backzettelFormat'
import type { DeltaExtras } from '../../lib/backzettelApi'
import { DeltaExtrasNote } from './DeltaExtrasNote'
import { PageSection } from '../layout'

const NUM = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const }

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: { xs: '1.25rem', md: '1.5rem' },
          fontWeight: 700,
          lineHeight: 1.25,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

/**
 * Chargen-Text; ohne Chargengröße oder Teiggewicht kein geschätzter Wert -
 * und es steht da, welche der beiden Zahlen fehlt. Dieselben Wörter wie die
 * Maschinen-Leiste (`batchesText`): Stammdaten sind „offen“, was sich daraus
 * nicht rechnen lässt, „unbekannt“.
 */
export function batchText(dough: HefeteigDough): string {
  if (!dough.batch_max_kg) return 'Chargengröße offen'
  if (dough.batches === null) {
    return `Chargen: unbekannt (Teiggewicht unbekannt) – je max. ${formatNumber(
      dough.batch_max_kg
    )} kg`
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
          <Figure label="Teigstücke" value={hefeteigPiecesText(dough)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <Figure label="Teig gesamt" value={hefeteigDoughText(dough)} />
        </Grid>
        {dough.liters && (
          <Grid item xs={6} sm={3}>
            <Figure label="Wasser" value={litersFigure(dough.liters)} />
            {litersHint(dough.liters) && (
              <Typography variant="caption" color="text.secondary">
                {litersHint(dough.liters)}
              </Typography>
            )}
          </Grid>
        )}
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
      {(dough.missing ?? []).length > 0 && (
        <Box
          component="ul"
          sx={{
            m: 0,
            mt: 1,
            pl: 2.5,
            typography: 'body2',
            color: 'text.secondary',
          }}
        >
          {(dough.missing ?? []).map((m) => (
            <li key={`${m.code}-${m.itemId}`}>{m.message}</li>
          ))}
        </Box>
      )}
      <Typography
        variant="subtitle2"
        component="h4"
        sx={{ mt: 2, mb: 0.5, fontWeight: 600 }}
      >
        Abwiegeliste
      </Typography>
      <Box sx={{ overflowX: 'auto', maxWidth: 720 }}>
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
              <TableRow key={w.piece_g ?? 'offen'}>
                <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {formatKnown(w.piece_g, 'g')}
                </TableCell>
                <TableCell sx={NUM}>
                  <Typography component="span" fontWeight={700}>
                    {weighingPiecesText(w)}
                  </Typography>
                </TableCell>
                <TableCell>{weighingItemsText(w.items)}</TableCell>
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
        <Typography
          component="div"
          sx={{
            fontSize: '1.25rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {fillingGramsText(filling)}
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
      {fillingOpenNote(filling) && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {fillingOpenNote(filling)}
        </Alert>
      )}
      {filling.missingFillingG && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Für mindestens einen Posten ist das Füllungsgewicht noch offen – die
          Menge oben fehlt bzw. ist zu klein, das Rezept wird nicht
          hochgerechnet.
        </Alert>
      )}
      {filling.recipe ? (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">
            {filling.recipe.factor === null || filling.recipe.batch_g === null
              ? recipeHeading(filling.recipe)
              : `Rezept „${filling.recipe.title}“ auf ${formatGrams(
                  filling.recipe.grams
                )} (Faktor ${formatNumber(
                  filling.recipe.factor
                )}, Grundrezept ${formatGrams(filling.recipe.batch_g)})`}
          </Typography>
          {recipeIncompleteNote(filling.recipe) && (
            <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
              {recipeIncompleteNote(filling.recipe)}
            </Alert>
          )}
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
                        {ingredientAmount(ing, filling.recipe).text}
                      </Typography>
                    ) : (
                      <strong>{formatGrams(ing.scaled_g)}</strong>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
  /** Was die Nachträge seit der Freigabe zusätzlich brauchen. */
  deltaExtras?: DeltaExtras | null
}

/**
 * „Hefeteig & Füllungen“: Teigstücke, Teig je Teigsorte, Chargen,
 * Abwiegeliste und Füllungsbedarf mit skaliertem Rezept - genau so, wie der
 * Server sie gerechnet hat (Entwurf live, freigegeben eingefroren).
 */
export function HefeteigCard({
  hefeteig,
  fillings,
  deltaExtras,
}: HefeteigCardProps) {
  const doughs = hefeteig?.doughs ?? []
  const list = fillings ?? []
  if (doughs.length === 0 && list.length === 0 && !deltaExtras) return null
  return (
    <PageSection title="Hefeteig & Füllungen" data-testid="hefeteig-card">
      <DeltaExtrasNote extras={deltaExtras} />
      <Stack spacing={3} divider={<Divider flexItem />} sx={{ mt: 1 }}>
        {doughs.map((d) => (
          <DoughBlock key={d.id} dough={d} />
        ))}
        {list.length > 0 && (
          <Box>
            <Typography variant="subtitle1" component="h3" fontWeight={700}>
              Füllungen
            </Typography>
            {/* Ab großem Bildschirm nebeneinander - jede Füllung ist ein
                eigener Arbeitsgang mit eigenem Rezept. */}
            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gap: { xs: 2, md: 3 },
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'repeat(auto-fill, minmax(340px, 1fr))',
                },
              }}
            >
              {list.map((f) => (
                <FillingBlock key={f.id} filling={f} />
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </PageSection>
  )
}

export default HefeteigCard
