import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bestellen - Bäckerei Heusser',
  description:
    'Bestellen Sie Brot, Brötchen, Kuchen und Torten bei der Bäckerei Heusser in Homburg-Kirrberg – telefonisch unter 06841 2229 oder per WhatsApp unter 0170 6133279, täglich von 05:30 bis 14:00 Uhr.',
}

export default function BestellenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
