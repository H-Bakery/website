import './global.css'
import './fonts.css'
import ThemeRegistry from '../components/providers/ThemeRegistry'
import { Header } from '../components/header'
import { LocalFooter } from '../components/LocalFooter'
import { getSeoOpeningHours } from '../utils/openingHours'
import { Box } from '@mui/material'
import { SITE_URL, LEGAL } from '../config/legal'

export const metadata = {
  title:
    'Bäckerei Heusser - Traditionelle Handwerksbäckerei in Homburg-Kirrberg',
  description:
    'Frische Backwaren aus traditioneller Handwerkskunst seit 1933. Brot, Brötchen, Kuchen und mehr täglich frisch gebacken in Kirrberg/Homburg.',
  keywords:
    'Bäckerei, Homburg, Kirrberg, Saarland, Brot, Brötchen, Kuchen, Handwerk, traditionell, frisch',
  authors: [{ name: 'Bäckerei Heusser' }],
  creator: 'Bäckerei Heusser',
  publisher: 'Bäckerei Heusser',
  manifest: '/manifest.json',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bäckerei Heusser - Traditionelle Handwerksbäckerei',
    description:
      'Frische Backwaren aus traditioneller Handwerkskunst seit 1933',
    url: SITE_URL,
    siteName: 'Bäckerei Heusser',
    images: [
      {
        url: '/og-image.jpg',
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
        {/* Lokal gehostete Webfonts (kein Google-Fonts-Abruf) */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/merriweather-latin.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/cinzel-latin.woff2"
          crossOrigin="anonymous"
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
              url: SITE_URL,
              telephone: '+49 6841 2229',
              email: LEGAL.email,
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
                latitude: '49.3014',
                longitude: '7.3695',
              },
              openingHoursSpecification: getSeoOpeningHours(),
              servesCuisine: 'German Bakery',
              priceRange: '€',
              founder: {
                '@type': 'Person',
                name: 'Heinrich Heusser',
              },
              foundingDate: '1933',
              image: [
                `${SITE_URL}/og-image.jpg`,
                `${SITE_URL}/assets/images/bakery/fresh-bread-hero.jpg`,
              ],
              sameAs: [
                'https://www.facebook.com/baeckereiheusser',
                'https://www.instagram.com/baeckereiheusser',
              ],
              menu: `${SITE_URL}/products`,
              paymentAccepted: ['Cash', 'Credit Card', 'Debit Card'],
              currenciesAccepted: 'EUR',
              areaServed: {
                '@type': 'GeoCircle',
                geoMidpoint: {
                  '@type': 'GeoCoordinates',
                  latitude: '49.3014',
                  longitude: '7.3695',
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
              url: SITE_URL,
              logo: `${SITE_URL}/logo.svg`,
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
              url: SITE_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${SITE_URL}/products?search={search_term_string}`,
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
                'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #FFF3E6',
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
