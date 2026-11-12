import React from 'react'
import { GlobalStyles } from '@mui/material'

/**
 * Drucken auf `/admin/hilfe` (P6): Die Seite trägt mehrere druckbare Blätter
 * (Spickzettel je Rolle, Papier-Regel, Vorbestellscheine, Notfallblatt). Jedes
 * ist ein `.hilfe-sheet[data-sheet=<id>]`. Ein „Drucken“-Knopf setzt
 * `data-hilfe-print=<id>` an `<html>`, ruft `window.print()` und nimmt das
 * Attribut nach `afterprint` wieder weg - gedruckt wird genau dieses eine
 * Blatt, auf einer A4-Seite, schwarz auf weiß, ohne AppBar und Navigation.
 *
 * Ohne Knopf (Strg+P) druckt die Seite das Blatt mit
 * `data-print-default="true"`: den gerade gezeigten Spickzettel.
 */

export const PRINT_ATTR = 'data-hilfe-print'

export type SheetId =
  | 'spickzettel-verkauf'
  | 'spickzettel-backstube'
  | 'spickzettel-backstubenleiter'
  | 'spickzettel-fahrer'
  | 'spickzettel-inhaber'
  | 'papier-regel'
  | 'vorbestellschein-2'
  | 'vorbestellschein-4'
  | 'notfallblatt'

export const SHEET_IDS: readonly SheetId[] = [
  'spickzettel-verkauf',
  'spickzettel-backstube',
  'spickzettel-backstubenleiter',
  'spickzettel-fahrer',
  'spickzettel-inhaber',
  'papier-regel',
  'vorbestellschein-2',
  'vorbestellschein-4',
  'notfallblatt',
]

/** Druckt genau ein Blatt. */
export function printSheet(id: SheetId): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  root.setAttribute(PRINT_ATTR, id)
  const cleanup = () => {
    root.removeAttribute(PRINT_ATTR)
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}

const selected: Record<string, { display: string }> = {}
for (const id of SHEET_IDS) {
  selected[`html[${PRINT_ATTR}="${id}"] .hilfe-sheet[data-sheet="${id}"]`] = {
    display: 'block !important',
  }
}

/**
 * Druckbild. Bildschirm-Teile tragen `.hilfe-screen` und fallen weg; Blätter,
 * die es nur auf Papier gibt, tragen zusätzlich `.hilfe-print-only`.
 */
export const hilfePrintStyles = (
  <GlobalStyles
    styles={{
      '.hilfe-print-only': { display: 'none' },
      '@media print': {
        '@page': { size: 'A4 portrait', margin: '10mm' },
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
          // CssBaseline enableColorScheme setzt im Dunkelmodus color-scheme:
          // dark - Chrome färbt dann den Seitenrand des Ausdrucks dunkel.
          colorScheme: 'light !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
          display: 'none !important',
        },
        main: {
          padding: '0 !important',
          margin: '0 !important',
          width: '100% !important',
        },
        'main > .MuiToolbar-root': { display: 'none !important' },
        '.hilfe-screen, .MuiSnackbar-root, nextjs-portal': {
          display: 'none !important',
        },
        // Kein Abstand vor dem Blatt: sonst rutscht ein seitenhohes Blatt
        // (Vorbestellschein, Notfallblatt) auf Seite 2 und Seite 1 bleibt leer.
        'main > div:has(> [aria-label="Pfad"])': { display: 'none !important' },
        '.hilfe-wrap, .hilfe-wrap > *': {
          padding: '0 !important',
          margin: '0 !important',
        },
        // Seitenrahmen (Layout-Kit: Kopf, Abschnitte, Karten, „Details“)
        // fällt weg: alles in `.hilfe-wrap`, das weder ein Blatt ist, in
        // einem Blatt steht noch ein Blatt enthält. Die Hüllen um ein Blatt
        // (Abschnitt, Karte, zugeklappte Details) werden zu schlichten
        // Blöcken ohne Abstand - sonst rutschte ein seitenhohes Blatt auf
        // Seite 2, und ein Blatt in zugeklappten Details bliebe unsichtbar.
        '.hilfe-wrap *:not(:has(.hilfe-sheet)):not(.hilfe-sheet):not(.hilfe-sheet *)':
          { display: 'none !important' },
        '.hilfe-wrap *:has(.hilfe-sheet)': {
          display: 'block !important',
          padding: '0 !important',
          margin: '0 !important',
          border: 'none !important',
          background: 'transparent !important',
          boxShadow: 'none !important',
          height: 'auto !important',
          minHeight: '0 !important',
          maxWidth: 'none !important',
          overflow: 'visible !important',
          visibility: 'visible !important',
        },
        // Alle Blätter aus; das gewählte (höhere Spezifität) wieder an. Nur EIN
        // Schlüssel `.hilfe-sheet` in diesem Objekt - ein zweiter ersetzte ihn.
        [`html:not([${PRINT_ATTR}]) .hilfe-sheet[data-print-default="true"]`]: {
          display: 'block !important',
        },
        ...selected,
        // Schwarz auf weiß, keine Schatten, keine Flächen außer gewollten.
        // global.css blendet jedes <section> ein (`sectionFadeIn`) - ein
        // gerade gewechselter Reiter druckte sonst halb durchsichtig.
        '.hilfe-sheet, .hilfe-sheet *': {
          animation: 'none !important',
          transition: 'none !important',
          opacity: '1 !important',
          color: '#000 !important',
          boxShadow: 'none !important',
          borderColor: '#000 !important',
        },
        '.hilfe-sheet': {
          display: 'none !important',
          background: '#fff !important',
          border: 'none !important',
          padding: '0 !important',
          margin: '0 !important',
          fontFamily: 'Arial, Helvetica, sans-serif !important',
          fontSize: '9.5pt !important',
          lineHeight: '1.3 !important',
          breakInside: 'avoid',
          pageBreakAfter: 'avoid',
        },
        '.hilfe-sheet .hilfe-shade': { background: '#eee !important' },
        '.hilfe-sheet .hilfe-plain': { background: 'transparent !important' },
        // Spickzettel: zwei Spalten, kompakte Schrift.
        '.spickzettel h2': {
          fontSize: '16pt !important',
          margin: '0 0 1mm !important',
        },
        '.spickzettel .sz-intro': {
          fontSize: '10pt !important',
          margin: '0 0 3mm !important',
        },
        // 1pt Luft rechts, sonst lag der rechte Rahmen der Kästen in der
        // rechten Spalte auf der Seitenkante und kam nur halb aufs Papier.
        '.spickzettel .sz-grid': {
          columnCount: '2 !important',
          columnGap: '6mm !important',
          paddingRight: '1pt !important',
        },
        '.spickzettel h3': {
          fontSize: '10.5pt !important',
          margin: '0 0 1mm !important',
        },
        '.spickzettel .sz-block': {
          padding: '1.5mm 2mm !important',
          margin: '0 0 2.5mm !important',
          border: '0.5pt solid #000 !important',
        },
        '.spickzettel .sz-block.sz-warning': {
          border: '1.5pt solid #000 !important',
        },
        '.spickzettel ol': {
          margin: '0 !important',
          paddingLeft: '4.5mm !important',
        },
        '.spickzettel li': {
          fontSize: '9.5pt !important',
          margin: '0 0 0.6mm !important',
        },
        // Aushang (Papier-Regel): größer, damit man es an der Wand liest.
        '.sz-poster h2': { fontSize: '22pt !important' },
        '.sz-poster .sz-intro': { fontSize: '12pt !important' },
        '.sz-poster h3': { fontSize: '13pt !important' },
        '.sz-poster li': { fontSize: '11.5pt !important' },
        '.sz-poster .sz-block': { padding: '2.5mm 3mm !important' },
        '.sz-poster .sz-contacts': {
          fontSize: '12pt !important',
          marginTop: '6mm !important',
        },
        '.spickzettel .sz-foot': {
          fontSize: '8pt !important',
          marginTop: '2mm !important',
        },
      },
    }}
  />
)

/** `**fett**` im Hilfetext → <strong>. Sonst reiner Text. */
export function renderInline(text: string): React.ReactNode {
  const parts = text.split('**')
  if (parts.length === 1) return text
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index}>{part}</strong>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  )
}
