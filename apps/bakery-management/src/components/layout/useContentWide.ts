'use client'
import React from 'react'
import { useMediaQuery, useTheme } from '@mui/material'

/**
 * Breite der Inhaltsfläche (neben der Seitenleiste, ohne Seitenrand), ab der
 * eine Tabelle mit sechs, sieben Spalten ganz hineinpasst (die Liste der
 * Vorbestellungen braucht gut 900 px). Quer am Laden-Tablet (1024-1200 px)
 * bleiben neben der festen Seitenleiste nur 700-870 px - dort lagen Summe,
 * Status und Stornieren seitlich außer Sicht. Ab 1280 px sind es 950 px.
 */
export const CONTENT_WIDE_MIN = 920

/** Die Inhaltsfläche der Verwaltung: `<main>` aus `admin/layout.tsx`. */
function contentArea(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector('main')
}

/** Breite ohne Innenabstand (Seitenrand) - wie `ResizeObserver` sie meldet. */
function innerWidth(element: HTMLElement): number {
  const style = window.getComputedStyle(element)
  const padding =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  return Math.max(0, element.clientWidth - padding)
}

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

/**
 * Passt eine breite Tabelle in die Inhaltsfläche? (Layout-Kit, README.md)
 *
 * Tabellen schalten nach der Breite des Inhalts um, nicht nach dem Fenster:
 * ab `md` (900 px) steht die Seitenleiste fest daneben und nimmt 280 px weg.
 * Gemessen wird `<main>` mit `ResizeObserver` (Drehen des Tablets, Fenster
 * ziehen). Solange nichts gemessen ist (Server, erster Render, ohne `<main>`
 * oder ohne `ResizeObserver`), gilt das Fenster ab `lg` (1200 px).
 *
 * `minWidth`: Breite in px, die die Tabelle braucht (Standard
 * `CONTENT_WIDE_MIN`).
 */
export function useContentWide(minWidth: number = CONTENT_WIDE_MIN): boolean {
  const theme = useTheme()
  const fallback = useMediaQuery(theme.breakpoints.up('lg'))
  const [width, setWidth] = React.useState<number | null>(null)

  useIsomorphicLayoutEffect(() => {
    const main = contentArea()
    if (!main || typeof ResizeObserver === 'undefined') return undefined
    setWidth(innerWidth(main))
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      setWidth(entry ? entry.contentRect.width : innerWidth(main))
    })
    observer.observe(main)
    return () => observer.disconnect()
  }, [])

  // 0 = nicht gelayoutet (jsdom, ausgeblendet): dann wie ohne Messung.
  return width ? width >= minWidth : fallback
}
