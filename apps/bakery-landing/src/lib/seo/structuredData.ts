import { getSeoOpeningHours } from '../../utils/openingHours'
import { LEGAL } from '../../config/legal'

export interface BakerySchema {
  '@context': string
  '@type': 'Bakery'
  name: string
  description: string
  url: string
  telephone: string
  email?: string
  address: {
    '@type': 'PostalAddress'
    streetAddress: string
    addressLocality: string
    addressRegion: string
    postalCode: string
    addressCountry: string
  }
  geo: {
    '@type': 'GeoCoordinates'
    latitude: string
    longitude: string
  }
  openingHoursSpecification: Array<{
    '@type': 'OpeningHoursSpecification'
    dayOfWeek: string | string[]
    opens: string
    closes: string
  }>
  servesCuisine: string
  priceRange: string
  founder: {
    '@type': 'Person'
    name: string
  }
  foundingDate: string
  image: string[]
  sameAs: string[]
  menu?: string
  hasMenu?: {
    '@type': 'Menu'
    name: string
    description: string
    url: string
  }
}

export interface ProductSchema {
  '@context': string
  '@type': 'Product'
  name: string
  description: string
  image: string
  brand: {
    '@type': 'Brand'
    name: string
  }
  offers: {
    '@type': 'Offer'
    price: string
    priceCurrency: string
    availability: string
    seller: {
      '@type': 'Organization'
      name: string
    }
  }
  category?: string
  sku?: string
  gtin?: string
  mpn?: string
}

export interface BreadcrumbSchema {
  '@context': string
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item?: string
  }>
}

export interface LocalBusinessSchema extends Omit<BakerySchema, '@type'> {
  '@type': 'LocalBusiness' | 'Bakery'
  paymentAccepted?: string[]
  currenciesAccepted?: string
  areaServed?: {
    '@type': 'GeoCircle'
    geoMidpoint: {
      '@type': 'GeoCoordinates'
      latitude: string
      longitude: string
    }
    geoRadius: string
  }
  aggregateRating?: {
    '@type': 'AggregateRating'
    ratingValue: string
    reviewCount: string
    bestRating: string
    worstRating: string
  }
}

export interface FAQSchema {
  '@context': string
  '@type': 'FAQPage'
  mainEntity: Array<{
    '@type': 'Question'
    name: string
    acceptedAnswer: {
      '@type': 'Answer'
      text: string
    }
  }>
}

// Main bakery structured data
export const getBakerySchema = (): BakerySchema => ({
  '@context': 'https://schema.org',
  '@type': 'Bakery',
  name: 'Bäckerei Heusser',
  description:
    'Traditionelle Handwerksbäckerei seit 1933 in Homburg/Kirrberg. Frische Backwaren, Brot, Brötchen, Kuchen und Torten täglich frisch gebacken.',
  url: 'https://xn--bckerei-heusser-0kb.de',
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
    latitude: '49.3169',
    longitude: '7.3364',
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
    'https://xn--bckerei-heusser-0kb.de/og-image.jpg',
    'https://xn--bckerei-heusser-0kb.de/assets/images/bakery/fresh-bread-hero.jpg',
    'https://xn--bckerei-heusser-0kb.de/assets/images/bakery/artisan-croissants.jpg',
  ],
  sameAs: [
    'https://www.facebook.com/baeckereiheusser',
    'https://www.instagram.com/baeckereiheusser',
  ],
  menu: 'https://xn--bckerei-heusser-0kb.de/products',
  hasMenu: {
    '@type': 'Menu',
    name: 'Bäckerei Heusser Sortiment',
    description: 'Unser komplettes Sortiment an frischen Backwaren',
    url: 'https://xn--bckerei-heusser-0kb.de/products',
  },
})

// Product structured data generator
export const getProductSchema = (product: {
  name: string
  description?: string
  price: number
  image?: string
  category?: string
  id?: string | number
}): ProductSchema => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.name,
  description:
    product.description ||
    `${product.name} - Frisch gebacken in unserer traditionellen Handwerksbäckerei`,
  image:
    product.image ||
    'https://xn--bckerei-heusser-0kb.de/assets/images/products/placeholder.jpg',
  brand: {
    '@type': 'Brand',
    name: 'Bäckerei Heusser',
  },
  offers: {
    '@type': 'Offer',
    price: product.price.toFixed(2),
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
    seller: {
      '@type': 'Organization',
      name: 'Bäckerei Heusser',
    },
  },
  category: product.category,
  sku: product.id?.toString(),
})

// Breadcrumb structured data generator
export const getBreadcrumbSchema = (
  items: Array<{ name: string; url?: string }>
): BreadcrumbSchema => {
  const baseUrl = 'https://xn--bckerei-heusser-0kb.de'

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url ? `${baseUrl}${item.url}` : undefined,
    })),
  }
}

// FAQ structured data generator
export const getFAQSchema = (
  faqs: Array<{ question: string; answer: string }>
): FAQSchema => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
})

// Organization structured data
export const getOrganizationSchema = () => ({
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
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Eckstraße 3',
    addressLocality: 'Homburg',
    addressRegion: 'Saarland',
    postalCode: '66424',
    addressCountry: 'DE',
  },
})
