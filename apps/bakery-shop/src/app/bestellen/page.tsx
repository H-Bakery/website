import { permanentRedirect } from 'next/navigation'

/**
 * Alte Bestell-Route.
 *
 * Früher lag hier die WhatsApp-/Telefon-Weitergabe. Bestellt wird jetzt im
 * Shop selbst, also 308 auf die Kasse — alte Links und Lesezeichen bleiben gültig.
 */
export default function BestellenPage(): never {
  permanentRedirect('/kasse')
}
