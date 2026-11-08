'use client'

import { ThemeToggle } from './ThemeToggle'
import styles from '../app/page.module.css'

/**
 * Fußzeile jeder Seite: das Farbschema. Es wird einmal eingestellt und dann
 * vergessen - im Kopf nahm der Umschalter dem Titel auf dem Handy die halbe
 * Breite weg.
 */
export function AppFooter() {
  return (
    <footer className={styles.footer}>
      <p>Darstellung</p>
      <ThemeToggle />
    </footer>
  )
}
