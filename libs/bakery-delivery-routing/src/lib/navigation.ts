// Uebergabe an die Navi-App des Fahrers.
//
// Die App zeichnet die Route nur; abbiegen laesst der Fahrer sich von Google
// oder Apple Maps. Deshalb muss der Sprung dorthin sauber funktionieren -
// inklusive Zwischenzielen, damit nicht jeder Stopp einzeln getippt wird.

export interface NavigationTarget {
  latitude: number
  longitude: number
  address?: string
}

/** Erkennt iOS/macOS, damit dort Apple Maps statt Google Maps geoeffnet wird. */
export function prefersAppleMaps(userAgent?: string): boolean {
  const ua =
    userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent)
  return /iPhone|iPad|iPod|Macintosh/i.test(ua)
}

/**
 * Link zu einem einzelnen Ziel.
 *
 * Es werden Koordinaten uebergeben und die Adresse nur als Beschriftung
 * mitgegeben: die Adresse haben wir bereits geokodiert, ein zweiter
 * Adress-Treffer in der Navi-App koennte woanders landen.
 */
export function buildNavigationUrl(
  target: NavigationTarget,
  userAgent?: string
): string {
  const coords = `${target.latitude},${target.longitude}`

  if (prefersAppleMaps(userAgent)) {
    const label = target.address
      ? `&q=${encodeURIComponent(target.address)}`
      : ''
    return `https://maps.apple.com/?daddr=${coords}&dirflg=d${label}`
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=driving`
}

/**
 * Link zu einem Ziel ohne brauchbare Koordinaten - die Adresssuche hat nichts
 * oder nur die Strasse gefunden. Dann bekommt die Navi-App den eingegebenen
 * Text: sie kennt die Hausnummer vielleicht doch, und die Strassenmitte waere
 * in jedem Fall das falschere Ziel.
 */
export function buildAddressNavigationUrl(
  address: string,
  userAgent?: string
): string {
  const destination = encodeURIComponent(address.trim())

  if (prefersAppleMaps(userAgent)) {
    return `https://maps.apple.com/?daddr=${destination}&dirflg=d`
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
}

/**
 * Link ueber mehrere Stopps. Google Maps nimmt bis zu neun Zwischenziele; mehr
 * werden abgeschnitten, damit der Link nicht stillschweigend kaputtgeht.
 *
 * Apple Maps kennt keine Zwischenziele in URLs - dort faellt der Link auf das
 * naechste Ziel zurueck.
 */
export const MAX_GOOGLE_WAYPOINTS = 9

export function buildMultiStopNavigationUrl(
  stops: NavigationTarget[],
  origin?: NavigationTarget,
  userAgent?: string
): string | null {
  if (stops.length === 0) return null
  if (prefersAppleMaps(userAgent))
    return buildNavigationUrl(stops[0], userAgent)

  const coords = (t: NavigationTarget) => `${t.latitude},${t.longitude}`
  const destination = stops[stops.length - 1]
  const waypoints = stops.slice(0, -1).slice(0, MAX_GOOGLE_WAYPOINTS)

  const params = new URLSearchParams({
    api: '1',
    destination: coords(destination),
    travelmode: 'driving',
  })
  if (origin) params.set('origin', coords(origin))
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(coords).join('|'))
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** `tel:`-Link. Leere oder unbrauchbare Nummern ergeben `null`, nicht `tel:`. */
export function buildPhoneLink(phone?: string | null): string | null {
  if (!phone) return null
  const cleaned = String(phone).replace(/[^\d+]/g, '')
  if (cleaned.replace(/\D/g, '').length < 5) return null
  return `tel:${cleaned}`
}
