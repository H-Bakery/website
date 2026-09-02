import { Metadata } from 'next'
import { getCompactHoursSummary } from '../../utils/openingHours'

// Die Bestellzeiten kommen aus der Öffnungszeiten-Konfiguration, damit die
// Meta-Description nicht anderes verspricht als Footer und Kontaktseite.
export const metadata: Metadata = {
  alternates: { canonical: '/bestellen' },
  title: 'Bestellen - Bäckerei Heusser',
  description: `Bestellen Sie Brot, Brötchen, Kuchen und Torten bei der Bäckerei Heusser in Homburg-Kirrberg – telefonisch unter 06841 2229 oder per WhatsApp unter 0170 6133279, während unserer Öffnungszeiten: ${getCompactHoursSummary()}.`,
}

export default function BestellenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
