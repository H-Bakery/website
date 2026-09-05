'use client'

import { useEffect, useState } from 'react'
import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  THEME_CHOICES,
  THEME_DESCRIPTION,
  THEME_LABEL,
  type ThemeChoice,
} from '../lib/theme'
import styles from '../app/page.module.css'

/**
 * System / Hell / Dunkel im Kopf der App.
 *
 * Der erste Render ist bewusst blind: er zeigt immer `system` und liest weder
 * `localStorage` noch `matchMedia`. Beides steht auf dem Server nicht zur
 * Verfuegung, das Markup wiche vom hydrierten ab, und React verwirft dann den
 * ganzen Baum. Die gespeicherte Wahl kommt im Effect nach - sichtbar bleibt
 * dabei nichts als der Rahmen, der um einen Knopf weiterspringt, denn die
 * *Farben* setzt bereits das Inline-Skript aus `layout.tsx` vor dem ersten Paint.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system')

  useEffect(() => {
    setChoice(readStoredTheme())
  }, [])

  function select(next: ThemeChoice) {
    setChoice(next)
    storeTheme(next)
    applyTheme(next)
  }

  return (
    <div
      className={styles.themeToggle}
      role="group"
      aria-label="Farbschema der App"
    >
      {THEME_CHOICES.map((option) => (
        <button
          key={option}
          type="button"
          className={
            option === choice
              ? `${styles.themeOption} ${styles.themeOptionActive}`
              : styles.themeOption
          }
          aria-label={THEME_DESCRIPTION[option]}
          aria-pressed={option === choice}
          onClick={() => select(option)}
        >
          {THEME_LABEL[option]}
        </button>
      ))}
    </div>
  )
}
