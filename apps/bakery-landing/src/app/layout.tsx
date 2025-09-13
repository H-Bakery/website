import './global.css'
import ThemeRegistry from '../components/providers/ThemeRegistry'
import { Header } from '../components/header'
import { LocalFooter } from '../components/LocalFooter'
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
        {/* Preconnect to font sources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* Preload critical fonts */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lora:wght@400;500&family=Ubuntu:wght@400;500&display=swap"
        />

        {/* Load fonts with font-display: swap for better performance */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lora:wght@400;500;600&family=Ubuntu:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />

        {/* Fallback for browsers without JS */}
        <noscript>
          <link
            href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lora:wght@400;500;600&family=Ubuntu:wght@300;400;500;700&display=swap"
            rel="stylesheet"
          />
        </noscript>
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

        {/* Schema.org structured data - Enhanced */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Bakery',
              name: 'Bäckerei Heusser',
              description:
                'Traditionelle Handwerksbäckerei seit 1933 in Homburg/Kirrberg. Frische Backwaren, Brot, Brötchen, Kuchen und Torten täglich frisch gebacken.',
              url: 'https://xn--bckerei-heusser-0kb.de',
              telephone: '+49 6841 2229',
              email: 'info@baeckerei-heusser.de',
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
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: [
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                  ],
                  opens: '06:00',
                  closes: '12:30',
                },
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: 'Saturday',
                  opens: '06:00',
                  closes: '12:00',
                },
              ],
              servesCuisine: 'German Bakery',
              priceRange: '€',
              founder: {
                '@type': 'Person',
                name: 'Heinrich Heusser',
              },
              foundingDate: '1933',
              image: [
                'https://xn--bckerei-heusser-0kb.de/og-image.jpg',
                'https://xn--bckerei-heusser-0kb.de/assets/images/bakery/fresh-bread-hero.jpg',
              ],
              sameAs: [
                'https://www.facebook.com/baeckereiheusser',
                'https://www.instagram.com/baeckereiheusser',
              ],
              menu: 'https://xn--bckerei-heusser-0kb.de/products',
              paymentAccepted: ['Cash', 'Credit Card', 'Debit Card'],
              currenciesAccepted: 'EUR',
              areaServed: {
                '@type': 'GeoCircle',
                geoMidpoint: {
                  '@type': 'GeoCoordinates',
                  latitude: '49.3169',
                  longitude: '7.3364',
                },
                geoRadius: '20000',
              },
            }),
          }}
        />

        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Bäckerei Heusser',
              url: 'https://xn--bckerei-heusser-0kb.de',
              logo: 'https://xn--bckerei-heusser-0kb.de/logo.svg',
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+49-6841-2229',
                contactType: 'customer service',
                areaServed: 'DE',
                availableLanguage: 'German',
              },
              sameAs: [
                'https://www.facebook.com/baeckereiheusser',
                'https://www.instagram.com/baeckereiheusser',
              ],
            }),
          }}
        />

        {/* WebSite Schema with SearchAction */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Bäckerei Heusser',
              url: 'https://xn--bckerei-heusser-0kb.de',
              potentialAction: {
                '@type': 'SearchAction',
                target:
                  'https://xn--bckerei-heusser-0kb.de/products?search={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
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
            <Box
              component="main"
              sx={{ flex: 1, minHeight: 'calc(100vh - 332px)' }}
            >
              {children}
            </Box>
            <LocalFooter />
          </Box>
        </ThemeRegistry>
      </body>
    </html>
  )
}
