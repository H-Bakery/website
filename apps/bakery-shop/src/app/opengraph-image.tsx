import { ImageResponse } from 'next/og'
import { BRAND_FACTS } from '@bakery/shared/utils'

/**
 * @fileoverview Das Vorschaubild des Shops für Social Media und Messenger.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
 *
 * **Kein Wiring nötig.** Next.js erkennt `src/app/opengraph-image.tsx` als
 * Metadata-Route und erzeugt daraus von selbst `og:image`, `og:image:alt`,
 * `og:image:width/height/type` sowie die `twitter:*`-Entsprechungen samt
 * `twitter:card=summary_large_image`. Vererbt wird das an jede Unterseite, die
 * kein eigenes Bild mitbringt. `layout.tsx` braucht dafür keine Zeile — nur
 * `metadataBase`, damit die URL absolut statt `localhost` wird (siehe Bericht).
 *
 * Auf dem Bild steht ausschließlich Nachprüfbares: Name, Ort, Gründungsjahr,
 * „Online-Shop“, wie bestellt wird und die Anschrift. Keine Bewertung, kein
 * Rabatt, keine Auszeichnung — dasselbe Verbot, das auch für die Startseite
 * gilt (§ 5 UWG, § 5b Abs. 3 UWG). Alle Angaben stammen aus `BRAND_FACTS`
 * (`libs/shared/utils/src/lib/brand.ts`), wo jede Zahl ihre Quelle trägt.
 *
 * Verfügbarkeit geprüft: `next@16.1.6` bringt `next/og` mit
 * (`node_modules/next/og.js`) inklusive der Standardschrift Noto Sans. Ein
 * statisches PNG als Ersatz war deshalb nicht nötig. Die selbstgehosteten
 * Markenschriften kommen hier trotzdem nicht zum Einsatz: sie liegen nur als
 * **woff2** in `public/fonts/`, und Satori liest woff2 nicht.
 *
 * ## Zwei Satori-Fallen, die dieses Bild schon gekostet hat
 *
 * 1. **Jedes `<div>` mit mehr als einem Kindknoten braucht `display: 'flex'`** —
 *    und zwei Textstücke sind bereits zwei Kindknoten. `Seit {jahr}` genügt
 *    also, um die Route mit „Expected <div> to have explicit display: flex“
 *    abstürzen zu lassen. Die Antwort bleibt dann vollständig leer; es gibt
 *    keine Fehlerseite und im Browser nur ein kaputtes Bild. Darum steht in
 *    jedem Textknoten unten **eine** Zeichenkette (Template-Literal), nie eine
 *    Folge aus Text und Ausdruck.
 * 2. Satori vererbt nichts: `fontFamily`, Farbe und Größe müssen dort stehen,
 *    wo sie wirken.
 */

/**
 * Markenfarben, gespiegelt aus `src/theme/theme.ts`.
 *
 * Der Umweg über Literale ist hier unvermeidbar: `theme.ts` trägt `'use client'`,
 * und eine Server-Route (das hier ist eine) bekäme daraus nur eine
 * Client-Referenz statt echter Werte. Satori kennt ohnehin kein MUI-Theme.
 * Ändern sich die Markenfarben, gehört diese Liste mitgezogen.
 */
const BRAND = {
  /** `palette.primary.main` — Dunkelbraun. */
  primary: '#5A2E2A',
  /** `palette.grey[50]` — Creme, der Hintergrund des Shops. */
  cream: '#FFF3E6',
  /** `palette.grey[200]` — Beige, hier als Trennlinie. */
  divider: '#E6D8C3',
  /** `palette.text.secondary` — Macchiato. */
  muted: '#928168',
  /** `palette.primary.contrastText`. */
  onPrimary: '#FFFFFF',
} as const

/**
 * Die Marke als Signet: der erste Pfad aus `HeusserLogo`
 * (`libs/shared/ui/src/lib/icons/brand/heusser-logo.tsx`) — das geschwungene H.
 * Er belegt im Original x 0…30,49 und y 0…40, daher die viewBox `0 0 31 40`.
 */
const BRAND_MARK_PATH =
  'M2.02115 9.79827C2.02115 10.7205 2.25213 11.5658 2.71411 12.3343C3.17609 13.0644 3.40707 13.6599 3.40707 14.121C3.40707 14.5437 3.29158 14.928 3.06059 15.2738C2.8681 15.6196 2.59862 15.7925 2.25213 15.7925C1.59767 15.7925 1.0587 15.2354 0.635217 14.121C0.211739 13.0067 0 11.8348 0 10.6052C0 8.7608 0.673715 7.10855 2.02115 5.64841C3.40707 4.18828 5.15873 3.45821 7.27612 3.45821C8.70055 3.45821 9.75925 4.14986 10.4522 5.53314C11.1837 6.878 11.5494 8.41498 11.5494 10.1441C11.5494 11.8732 11.4917 13.5062 11.3762 15.0432C11.2992 16.5418 11.2222 17.7137 11.1452 18.5591C11.0682 19.366 10.9142 20.6724 10.6832 22.4784C10.4522 24.2459 10.2982 25.4755 10.2212 26.1671C13.3011 26.1671 16.5349 24.611 19.9227 21.4986C20.3847 15.9654 21.0199 11.6426 21.8284 8.53026C22.6753 5.37944 23.5223 3.17003 24.3692 1.90202C25.2162 0.634005 26.1209 0 27.0834 0C28.0843 0 28.8928 0.441882 29.5087 1.32565C30.1632 2.20941 30.4904 3.26609 30.4904 4.49568C30.4904 9.02978 28.4693 13.9289 24.427 19.1931C24.196 22.2286 24.0805 25.0336 24.0805 27.6081C24.0805 30.1441 24.4462 32.6225 25.1777 35.0432C25.9477 37.4256 26.3326 38.7512 26.3326 39.0202C26.3326 39.3276 26.1209 39.5581 25.6974 39.7118C25.2739 39.9039 24.812 40 24.3115 40C22.9641 40 21.8669 39.6542 21.0199 38.9625C20.5964 38.6167 20.25 37.4448 19.9805 35.4467C19.711 33.4486 19.5762 31.585 19.5762 29.8559C19.5762 28.0884 19.634 26.1864 19.7495 24.1499C16.3232 27.0701 13.0701 28.5879 9.99023 28.7032C9.95174 29.2411 9.91324 30.1441 9.87474 31.4121C9.83624 32.6417 9.77849 33.5639 9.7015 34.1787C9.6245 34.755 9.47051 35.4275 9.23952 36.196C8.85454 37.6177 7.93059 38.3285 6.46767 38.3285C5.58221 38.3285 5.13948 37.5792 5.13948 36.0807C5.13948 34.5437 5.37047 31.8924 5.83245 28.1268C4.10004 27.3967 3.23383 26.1095 3.23383 24.2651C3.23383 22.9203 3.58032 21.7867 4.27328 20.8646C4.96624 19.9039 5.8132 19.4236 6.81415 19.4236C7.16063 15.8886 7.33387 13.1604 7.33387 11.2392C7.33387 7.78098 6.7949 6.05187 5.71696 6.05187C3.25308 6.05187 2.02115 7.30067 2.02115 9.79827ZM28.6425 5.4755C28.6425 4.89913 28.5463 4.3804 28.3538 3.91931C28.1998 3.41979 27.9881 3.17003 27.7186 3.17003C26.6406 3.17003 25.6589 7.3391 24.7735 15.6772C27.3528 11.7579 28.6425 8.35735 28.6425 5.4755ZM6.64091 21.268C6.10193 21.6523 5.83245 22.171 5.83245 22.8242C5.83245 23.4774 5.98644 24.0154 6.29443 24.438L6.64091 21.268Z'

/** Beschreibt, was zu sehen ist — sonst kündigt ein Screenreader nichts an. */
export const alt =
  'Bäckerei Heusser Online-Shop – Backwaren vorbestellen und in Homburg abholen'

/** Von Facebook, WhatsApp, LinkedIn und X gleichermaßen akzeptiertes Format. */
export const size = { width: 1200, height: 630 }

export const contentType = 'image/png'

/** `'06841 2229'` → `'+49 6841 2229'` — abgeleitet, nicht abgeschrieben. */
const displayPhone = BRAND_FACTS.phone.replace(/^0/, '+49 ')

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: BRAND.cream,
          fontFamily: 'sans-serif',
          padding: '72px 80px',
        }}
      >
        {/* Kopf: Signet, Gründungsjahr, Ort */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg
            width={62}
            height={80}
            viewBox="0 0 31 40"
            fill={BRAND.primary}
            style={{ marginRight: 28 }}
          >
            <path d={BRAND_MARK_PATH} fill={BRAND.primary} />
          </svg>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: 26,
                letterSpacing: 6,
                color: BRAND.muted,
                textTransform: 'uppercase',
              }}
            >
              {`Seit ${BRAND_FACTS.foundedYear}`}
            </div>
            <div style={{ fontSize: 30, color: BRAND.primary, marginTop: 6 }}>
              {`${BRAND_FACTS.city}-${BRAND_FACTS.district}`}
            </div>
          </div>
        </div>

        {/* Mitte: Name und Zweck */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: BRAND.primary,
              lineHeight: 1.05,
            }}
          >
            Bäckerei Heusser
          </div>
          <div style={{ display: 'flex', marginTop: 28 }}>
            <div
              style={{
                display: 'flex',
                backgroundColor: BRAND.primary,
                color: BRAND.onPrimary,
                fontSize: 40,
                letterSpacing: 3,
                padding: '12px 28px',
                borderRadius: 8,
              }}
            >
              Online-Shop
            </div>
          </div>
          <div style={{ fontSize: 38, color: BRAND.muted, marginTop: 28 }}>
            Vorbestellen, im Laden abholen, im Laden bezahlen.
          </div>
        </div>

        {/* Fuß: Anschrift und Telefon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderTop: `2px solid ${BRAND.divider}`,
            paddingTop: 28,
            fontSize: 30,
            color: BRAND.primary,
          }}
        >
          {`${BRAND_FACTS.street} · ${BRAND_FACTS.postalCode} ${BRAND_FACTS.city} · ${displayPhone}`}
        </div>
      </div>
    ),
    { ...size }
  )
}
