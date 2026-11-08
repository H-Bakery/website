'use client'
import { getInitColorSchemeScript } from '@mui/material/styles'

/**
 * Setzt das Farbschema (hell/dunkel nach System) an <html>, bevor React
 * lädt - kein Aufblitzen des hellen Themes im Dunkelmodus. Als
 * Client-Komponente, weil MUI die Funktion als Client-Code markiert.
 */
export default function ColorSchemeScript() {
  return getInitColorSchemeScript({ defaultMode: 'system' })
}
