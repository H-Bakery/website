// @ts-nocheck
/**
 * @fileoverview Mock customer data
 * @module @bakery/shared/data-mocks/users
 */

import { Customer } from '@bakery/shared/types'

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 1,
    customerId: 'CUST-001',
    name: 'Peter Klein',
    email: 'kunde@example.com',
    phone: '+49 123 456789',
    address: {
      street: 'Hauptstraße 42',
      city: 'München',
      postalCode: '80331',
      country: 'Deutschland',
    },
    type: 'individual',
    isActive: true,
    loyaltyPoints: 150,
    totalOrders: 23,
    totalSpent: 458.5,
    averageOrderValue: 19.93,
    lastOrderDate: new Date('2024-01-18'),
    registeredAt: new Date('2023-07-20'),
    preferences: {
      newsletter: true,
      smsNotifications: false,
      favoriteProducts: [1, 3, 16, 24], // Product IDs
      dietaryRestrictions: [],
      preferredPaymentMethod: 'EC-Karte',
      preferredDeliveryTime: 'morning',
    },
    notes: 'Stammkunde, bestellt regelmäßig Kornbrot und Brötchen',
    tags: ['Stammkunde', 'Brot-Liebhaber'],
  },
  {
    id: 2,
    customerId: 'CUST-002',
    name: 'Café Sonnenschein',
    email: 'info@cafe-sonnenschein.de',
    phone: '+49 89 12345678',
    address: {
      street: 'Marienplatz 8',
      city: 'München',
      postalCode: '80331',
      country: 'Deutschland',
    },
    type: 'business',
    isActive: true,
    businessName: 'Café Sonnenschein GmbH',
    taxId: 'DE123456789',
    contactPerson: 'Maria Huber',
    totalOrders: 156,
    totalSpent: 12450.8,
    averageOrderValue: 79.81,
    lastOrderDate: new Date('2024-01-19'),
    registeredAt: new Date('2023-01-15'),
    creditLimit: 5000,
    paymentTerms: 30, // days
    preferences: {
      newsletter: true,
      smsNotifications: true,
      favoriteProducts: [8, 9, 14, 16, 17], // Brötchen and cakes for café
      dietaryRestrictions: [],
      preferredPaymentMethod: 'Rechnung',
      preferredDeliveryTime: 'early-morning',
      deliveryInstructions: 'Lieferung bis 6:30 Uhr, Hintereingang benutzen',
    },
    notes: 'Wichtiger Geschäftskunde, tägliche Lieferung',
    tags: ['B2B', 'Café', 'Tägliche Lieferung', 'Premium'],
  },
  {
    id: 3,
    customerId: 'CUST-003',
    name: 'Hotel Bayerischer Hof',
    email: 'einkauf@bayerischerhof.de',
    phone: '+49 89 21200',
    address: {
      street: 'Promenadeplatz 2-6',
      city: 'München',
      postalCode: '80333',
      country: 'Deutschland',
    },
    type: 'business',
    isActive: true,
    businessName: 'Hotel Bayerischer Hof AG',
    taxId: 'DE987654321',
    contactPerson: 'Thomas Bauer',
    totalOrders: 312,
    totalSpent: 45678.9,
    averageOrderValue: 146.47,
    lastOrderDate: new Date('2024-01-20'),
    registeredAt: new Date('2022-11-01'),
    creditLimit: 15000,
    paymentTerms: 45,
    preferences: {
      newsletter: true,
      smsNotifications: true,
      favoriteProducts: [1, 2, 3, 4, 8, 9, 10, 14, 16, 17, 18], // Various for hotel breakfast
      dietaryRestrictions: ['glutenfrei', 'vegan'],
      preferredPaymentMethod: 'Rechnung',
      preferredDeliveryTime: 'early-morning',
      deliveryInstructions: 'Lieferung an Küche, Ansprechpartner: Küchenchef',
    },
    notes: 'Premium Hotelkunde, benötigt auch glutenfreie und vegane Optionen',
    tags: ['B2B', 'Hotel', 'Premium', 'Großkunde'],
  },
  {
    id: 4,
    customerId: 'CUST-004',
    name: 'Familie Schmidt',
    email: 'schmidt.family@gmail.com',
    phone: '+49 172 3456789',
    address: {
      street: 'Blumenstraße 15',
      city: 'München',
      postalCode: '80469',
      country: 'Deutschland',
    },
    type: 'individual',
    isActive: true,
    totalOrders: 45,
    totalSpent: 678.9,
    averageOrderValue: 15.09,
    lastOrderDate: new Date('2024-01-17'),
    registeredAt: new Date('2023-03-10'),
    loyaltyPoints: 320,
    preferences: {
      newsletter: true,
      smsNotifications: true,
      favoriteProducts: [5, 12, 16, 19], // Family favorites
      dietaryRestrictions: ['laktosefrei'],
      preferredPaymentMethod: 'PayPal',
      preferredDeliveryTime: 'afternoon',
      deliveryInstructions: 'Bitte klingeln, 2. Stock',
    },
    notes: 'Familie mit 2 Kindern, Tochter ist laktoseintolerant',
    tags: ['Familie', 'Stammkunde', 'Laktosefrei'],
  },
  {
    id: 5,
    customerId: 'CUST-005',
    name: 'Büro Müller & Partner',
    email: 'bestellung@mueller-partner.de',
    phone: '+49 89 987654',
    address: {
      street: 'Leopoldstraße 100',
      city: 'München',
      postalCode: '80802',
      country: 'Deutschland',
    },
    type: 'business',
    isActive: true,
    businessName: 'Müller & Partner Rechtsanwälte',
    taxId: 'DE112233445',
    contactPerson: 'Sabine Krause',
    totalOrders: 89,
    totalSpent: 2345.6,
    averageOrderValue: 26.35,
    lastOrderDate: new Date('2024-01-19'),
    registeredAt: new Date('2023-02-20'),
    creditLimit: 2000,
    paymentTerms: 14,
    preferences: {
      newsletter: false,
      smsNotifications: true,
      favoriteProducts: [8, 9, 27, 28], // Office breakfast items
      dietaryRestrictions: [],
      preferredPaymentMethod: 'Lastschrift',
      preferredDeliveryTime: 'morning',
      deliveryInstructions: 'Empfang, Frau Krause benachrichtigen',
    },
    notes: 'Regelmäßige Bestellung für Meetings und Frühstück',
    tags: ['B2B', 'Büro', 'Regelmäßig'],
  },
  {
    id: 6,
    customerId: 'CUST-006',
    name: 'Sarah Weber',
    email: 'sarah.weber@web.de',
    phone: '+49 151 23456789',
    address: {
      street: 'Sendlinger Straße 55',
      city: 'München',
      postalCode: '80331',
      country: 'Deutschland',
    },
    type: 'individual',
    isActive: true,
    totalOrders: 67,
    totalSpent: 890.45,
    averageOrderValue: 13.29,
    lastOrderDate: new Date('2024-01-16'),
    registeredAt: new Date('2023-04-05'),
    loyaltyPoints: 445,
    preferences: {
      newsletter: true,
      smsNotifications: false,
      favoriteProducts: [7, 13, 20, 31], // Healthy options
      dietaryRestrictions: ['vegan', 'glutenfrei'],
      preferredPaymentMethod: 'Kreditkarte',
      preferredDeliveryTime: 'evening',
    },
    notes: 'Veganerin, bestellt oft glutenfreie Produkte',
    tags: ['Vegan', 'Glutenfrei', 'Gesundheitsbewusst'],
  },
  {
    id: 7,
    customerId: 'CUST-007',
    name: 'Kindergarten Regenbogen',
    email: 'leitung@kiga-regenbogen.de',
    phone: '+49 89 445566',
    address: {
      street: 'Schulstraße 10',
      city: 'München',
      postalCode: '81675',
      country: 'Deutschland',
    },
    type: 'business',
    isActive: true,
    businessName: 'Kindergarten Regenbogen e.V.',
    taxId: 'DE998877665',
    contactPerson: 'Frau Lehmann',
    totalOrders: 134,
    totalSpent: 3456.78,
    averageOrderValue: 25.8,
    lastOrderDate: new Date('2024-01-18'),
    registeredAt: new Date('2023-01-20'),
    creditLimit: 1000,
    paymentTerms: 30,
    preferences: {
      newsletter: true,
      smsNotifications: true,
      favoriteProducts: [8, 12, 16, 21], // Kid-friendly items
      dietaryRestrictions: ['nussfrei'],
      preferredPaymentMethod: 'Rechnung',
      preferredDeliveryTime: 'morning',
      deliveryInstructions: 'Lieferung bis 8:00 Uhr, Küche',
    },
    notes: 'Kindergarten, Achtung: Nussallergie bei einigen Kindern',
    tags: ['B2B', 'Bildungseinrichtung', 'Nussfrei', 'Sensibel'],
  },
  {
    id: 8,
    customerId: 'CUST-008',
    name: 'Restaurant Augustiner',
    email: 'kueche@augustiner-restaurant.de',
    phone: '+49 89 778899',
    address: {
      street: 'Neuhauser Straße 27',
      city: 'München',
      postalCode: '80331',
      country: 'Deutschland',
    },
    type: 'business',
    isActive: false, // Inactive customer
    businessName: 'Augustiner Restaurant GmbH',
    taxId: 'DE556677889',
    contactPerson: 'Chef Koch Meyer',
    totalOrders: 203,
    totalSpent: 15678.9,
    averageOrderValue: 77.23,
    lastOrderDate: new Date('2023-10-15'),
    registeredAt: new Date('2022-08-01'),
    creditLimit: 8000,
    paymentTerms: 60,
    deactivatedAt: new Date('2023-11-01'),
    deactivationReason: 'Zahlungsverzug',
    preferences: {
      newsletter: false,
      smsNotifications: false,
      favoriteProducts: [1, 3, 5, 24, 25], // Traditional items
      dietaryRestrictions: [],
      preferredPaymentMethod: 'Rechnung',
      preferredDeliveryTime: 'early-morning',
    },
    notes: 'ACHTUNG: Kunde gesperrt wegen ausstehender Zahlungen',
    tags: ['B2B', 'Restaurant', 'GESPERRT', 'Zahlungsverzug'],
  },
]

// Helper functions
export const getCustomerById = (id: number): Customer | undefined => {
  return MOCK_CUSTOMERS.find((customer) => customer.id === id)
}

export const getCustomerByCustomerId = (
  customerId: string
): Customer | undefined => {
  return MOCK_CUSTOMERS.find((customer) => customer.customerId === customerId)
}

export const getCustomerByEmail = (email: string): Customer | undefined => {
  return MOCK_CUSTOMERS.find((customer) => customer.email === email)
}

export const getActiveCustomers = (): Customer[] => {
  return MOCK_CUSTOMERS.filter((customer) => customer.isActive)
}

export const getBusinessCustomers = (): Customer[] => {
  return MOCK_CUSTOMERS.filter((customer) => customer.type === 'business')
}

export const getIndividualCustomers = (): Customer[] => {
  return MOCK_CUSTOMERS.filter((customer) => customer.type === 'individual')
}

export const getTopCustomers = (limit: number = 5): Customer[] => {
  return MOCK_CUSTOMERS.filter((customer) => customer.isActive)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit)
}

export const searchCustomers = (query: string): Customer[] => {
  const lowercaseQuery = query.toLowerCase()
  return MOCK_CUSTOMERS.filter(
    (customer) =>
      customer.name.toLowerCase().includes(lowercaseQuery) ||
      customer.email.toLowerCase().includes(lowercaseQuery) ||
      customer.customerId.toLowerCase().includes(lowercaseQuery) ||
      customer.businessName?.toLowerCase().includes(lowercaseQuery) ||
      customer.tags?.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
  )
}
