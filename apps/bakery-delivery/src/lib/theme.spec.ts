import {
  applyTheme,
  isThemeChoice,
  readStoredTheme,
  storeTheme,
  THEME_CHOICES,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme'

/**
 * jsdom laesst `window.localStorage` nicht ausspionieren (die Eigenschaft ist
 * nicht beschreibbar), deshalb wird sie fuer die Fehlerfaelle komplett ersetzt.
 */
function withBrokenStorage(run: () => void) {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
  const broken = {
    getItem() {
      throw new Error('SecurityError')
    },
    setItem() {
      throw new Error('SecurityError')
    },
  }
  Object.defineProperty(window, 'localStorage', {
    value: broken,
    configurable: true,
  })
  try {
    run()
  } finally {
    if (original) Object.defineProperty(window, 'localStorage', original)
  }
}

describe('theme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('erkennt nur die drei gueltigen Werte', () => {
    expect(THEME_CHOICES).toEqual(['system', 'light', 'dark'])
    expect(isThemeChoice('dark')).toBe(true)
    expect(isThemeChoice('Dunkel')).toBe(false)
    expect(isThemeChoice(null)).toBe(false)
  })

  it('liest und schreibt die Wahl unter dem vereinbarten Schluessel', () => {
    storeTheme('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('faellt bei unbekanntem Inhalt auf "system" zurueck', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readStoredTheme()).toBe('system')
  })

  // Im privaten Modus mancher Browser wirft schon der Zugriff auf localStorage.
  // Ein Farbschema darf die Fahrer-App nicht abstuerzen lassen.
  it('wirft nicht, wenn localStorage nicht zur Verfuegung steht', () => {
    withBrokenStorage(() => {
      expect(readStoredTheme()).toBe('system')
      expect(() => storeTheme('light')).not.toThrow()
    })
  })

  it('setzt data-theme bei ausdruecklicher Wahl und entfernt es bei "system"', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // Nicht "system" eintragen: erst ohne Attribut greift die Media Query wieder.
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  describe('Inline-Skript', () => {
    function run() {
      // eslint-disable-next-line no-new-func
      new Function(THEME_INIT_SCRIPT)()
    }

    it('setzt data-theme aus dem Speicher, bevor React laeuft', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      run()
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('laesst das Attribut bei "system" und bei Unfug weg', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'system')
      run()
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)

      window.localStorage.setItem(THEME_STORAGE_KEY, 'dunkel')
      run()
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    })

    // Es laeuft im <head>: ein Fehler dort haelt die ganze Seite an.
    it('wirft nicht, wenn localStorage wirft', () => {
      withBrokenStorage(() => {
        expect(run).not.toThrow()
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
      })
    })
  })
})
