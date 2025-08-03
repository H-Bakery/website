import './global.css'
import ThemeRegistry from '../components/providers/ThemeRegistry'
import { Header } from '../components/header'
import Footer from '../components/footer/Index'
import { Box } from '@mui/material'

export const metadata = {
  title:
    'Bäckerei Heusser - Traditionelle Handwerksbäckerei in Karlsruhe-Beiertheim',
  description:
    'Frische Backwaren aus traditioneller Handwerkskunst seit 1933. Brot, Brötchen, Kuchen und mehr täglich frisch gebacken in Kirrberg/Homburg.',
  keywords:
    'Bäckerei, Karlsruhe, Beiertheim, Homburg, Kirrberg, Brot, Brötchen, Kuchen, Handwerk, traditionell, frisch',
  authors: [{ name: 'Bäckerei Heusser' }],
  creator: 'Bäckerei Heusser',
  publisher: 'Bäckerei Heusser',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://baeckerei-heusser.de'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bäckerei Heusser - Traditionelle Handwerksbäckerei',
    description:
      'Frische Backwaren aus traditioneller Handwerkskunst seit 1933',
    url: 'https://baeckerei-heusser.de',
    siteName: 'Bäckerei Heusser',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Bäckerei Heusser - Frische Backwaren',
      },
    ],
    locale: 'de_DE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bäckerei Heusser - Traditionelle Handwerksbäckerei',
    description:
      'Frische Backwaren aus traditioneller Handwerkskunst seit 1933',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lora:wght@400;500;600&family=Ubuntu:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="icon" href="/favicon.ico" />

        {/* Schema.org structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Bakery',
              name: 'Bäckerei Heusser',
              description: 'Traditionelle Handwerksbäckerei seit 1933',
              url: 'https://baeckerei-heusser.de',
              telephone: '+49 6841 2229',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Eckstraße 3',
                addressLocality: 'Homburg',
                addressRegion: 'Saarland',
                postalCode: '66424',
                addressCountry: 'DE',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: '49.3169',
                longitude: '7.3364',
              },
              openingHours: ['Mo-Fr 06:00-12:30', 'Sa 06:00-12:00'],
              servesCuisine: 'German',
              priceRange: '€',
              founder: 'Heinrich Heusser',
              foundingDate: '1933',
            }),
          }}
        />
      </head>
      <body>
        <ThemeRegistry>
          <Box
            sx={{
              background:
                'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4',
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Header />
            <Box component="main" sx={{ flex: 1, minHeight: 'calc(100vh - 332px)' }}>
              {children}
            </Box>
            <Footer />
          </Box>
        </ThemeRegistry>
      </body>
    </html>
  )
}
