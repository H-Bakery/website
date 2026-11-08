'use client'

import React from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import type {
  DeltaExtras,
  FillingNeed,
  Hefeteig,
  HefeteigDough,
} from '../../lib/backzettelApi'
import { DeltaExtrasNote } from '../backzettel/DeltaExtrasNote'
import {
  formatGrams,
  formatNumber,
  ingredientAmount,
  recipeHeading,
  recipeIncompleteNote,
} from '../../lib/backzettelFormat'
import { batchText } from '../backzettel/HefeteigCard'

const BIG = { xs: '1.75rem', sm: '2.25rem' }
const MID = { xs: '1.2rem', sm: '1.45rem' }
const SMALL = { xs: '1rem', sm: '1.1rem' }

function Figure({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted: boolean
}) {
  return (
    <Box sx={{ minWidth: 130 }}>
      <Typography sx={{ fontSize: SMALL, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: BIG,
          fontWeight: 800,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          color: muted ? 'text.secondary' : 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function Dough({ dough, muted }: { dough: HefeteigDough; muted: boolean }) {
  return (
    <Box data-testid={`bs-dough-${dough.id}`}>
      <Typography component="h3" sx={{ fontSize: MID, fontWeight: 700 }}>
        {dough.name}
      </Typography>
      <Stack direction="row" flexWrap="wrap" sx={{ gap: 3, mt: 1 }}>
        <Figure
          label="Teigstücke"
          value={formatNumber(dough.pieces)}
          muted={muted}
        />
        <Figure
          label="Teig gesamt"
          value={formatGrams(dough.dough_g)}
          muted={muted}
        />
        <Box>
          <Figure
            label="Chargen"
            value={dough.batches === null ? '–' : formatNumber(dough.batches)}
            muted={muted}
          />
          <Typography sx={{ fontSize: SMALL, color: 'text.secondary' }}>
            {batchText(dough)}
          </Typography>
        </Box>
      </Stack>
      <Typography
        component="h4"
        sx={{ fontSize: MID, fontWeight: 700, mt: 2, mb: 1 }}
      >
        Abwiegen
      </Typography>
      <Stack spacing={1}>
        {dough.weighing.map((w) => (
          <Box
            key={w.piece_g}
            data-testid={`bs-weigh-${dough.id}-${w.piece_g}`}
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              columnGap: 2,
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              sx={{
                fontSize: BIG,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: muted ? 'text.secondary' : 'text.primary',
              }}
            >
              {formatNumber(w.pieces)} × {formatNumber(w.piece_g)} g
            </Typography>
            <Typography sx={{ fontSize: SMALL, color: 'text.secondary' }}>
              {w.items
                .map((i) =>
                  i.piecesPerProduct === 1
                    ? `${i.name} ${formatNumber(i.products)}`
                    : `${i.name} ${formatNumber(i.products)} × ${
                        i.piecesPerProduct
                      }`
                )
                .join(', ')}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

function Filling({ filling, muted }: { filling: FillingNeed; muted: boolean }) {
  return (
    <Box
      data-testid={`bs-filling-${filling.id}`}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ fontSize: MID, fontWeight: 700 }}>
          {filling.name}
        </Typography>
        <Typography
          sx={{
            fontSize: BIG,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: muted ? 'text.secondary' : 'text.primary',
          }}
        >
          {formatGrams(filling.grams)}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: SMALL, color: 'text.secondary' }}>
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
        <Typography sx={{ fontSize: SMALL, fontWeight: 700, mt: 0.5 }}>
          Achtung: Für mindestens einen Posten fehlt das Füllungsgewicht – die
          Menge ist zu klein.
        </Typography>
      )}
      {filling.recipe ? (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: SMALL, color: 'text.secondary' }}>
            {recipeHeading(filling.recipe)}
          </Typography>
          {recipeIncompleteNote(filling.recipe) && (
            <Typography
              sx={{ fontSize: SMALL, fontWeight: 700, mt: 0.5 }}
              data-testid="recipe-incomplete"
            >
              {recipeIncompleteNote(filling.recipe)}
            </Typography>
          )}
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              columnGap: 2,
              rowGap: 0.5,
              m: 0,
              mt: 0.5,
            }}
          >
            {filling.recipe.ingredients.map((ing, idx) => (
              <React.Fragment key={`${ing.name}-${idx}`}>
                <Box component="dt" sx={{ fontSize: MID }}>
                  {ing.name}
                </Box>
                <Box
                  component="dd"
                  sx={{
                    m: 0,
                    fontSize: MID,
                    fontWeight: 700,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ingredientAmount(ing, filling.recipe).text}
                </Box>
              </React.Fragment>
            ))}
          </Box>
        </Box>
      ) : filling.recipeMissing ? (
        <Typography sx={{ fontSize: SMALL, color: 'text.secondary', mt: 1 }}>
          Kein Rezept hinterlegt.
        </Typography>
      ) : null}
    </Box>
  )
}

export interface BackstubeHefeteigProps {
  hefeteig: Hefeteig | null
  fillings: FillingNeed[] | null
  /** Entwurf: Zahlen ausgegraut. */
  draft: boolean
  /** Was die Nachträge seit der Freigabe zusätzlich brauchen. */
  deltaExtras?: DeltaExtras | null
}

/**
 * „Hefeteig & Füllungen“ für das Tablet - am Samstag die erste Karte.
 * Dieselben Server-Zahlen wie `HefeteigCard` (Tagesplanung), nur groß.
 */
export function BackstubeHefeteig({
  hefeteig,
  fillings,
  draft,
  deltaExtras,
}: BackstubeHefeteigProps) {
  const doughs = hefeteig?.doughs ?? []
  const list = fillings ?? []
  if (doughs.length === 0 && list.length === 0 && !deltaExtras) return null
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby="bs-hefeteig-title"
      data-testid="bs-hefeteig"
      sx={{
        p: { xs: 2, sm: 3 },
        borderWidth: 2,
        borderStyle: draft ? 'dashed' : 'solid',
      }}
    >
      <Typography
        id="bs-hefeteig-title"
        component="h2"
        sx={{
          fontSize: { xs: '1.5rem', sm: '1.9rem' },
          fontWeight: 800,
          mb: 2,
        }}
      >
        Hefeteig &amp; Füllungen
      </Typography>
      <Stack spacing={3}>
        <DeltaExtrasNote extras={deltaExtras} large />
        {doughs.map((d) => (
          <Dough key={d.id} dough={d} muted={draft} />
        ))}
        {list.length > 0 && (
          <Box>
            <Typography
              component="h3"
              sx={{ fontSize: MID, fontWeight: 700, mb: 1 }}
            >
              Füllungen
            </Typography>
            <Stack spacing={1.5}>
              {list.map((f) => (
                <Filling key={f.id} filling={f} muted={draft} />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}

export default BackstubeHefeteig
