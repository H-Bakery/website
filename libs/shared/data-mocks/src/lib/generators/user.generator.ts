/**
 * @fileoverview User and customer data generator for testing and development
 * @module @bakery/shared/data-mocks/generators
 */

import { User, UserRole, Customer } from '@bakery/shared/types'

interface UserGeneratorOptions {
  role?: UserRole
  isActive?: boolean
  department?: string
}

interface CustomerGeneratorOptions {
  type?: 'individual' | 'business'
  isActive?: boolean
  businessType?: string
}

/**
 * Generate random user and customer data
 */
export class UserGenerator {
  private static userIdCounter = 100
  private static customerIdCounter = 100

  // German name data
  private static firstNames = [
    'Anna',
    'Ben',
    'Clara',
    'David',
    'Emma',
    'Felix',
    'Greta',
    'Hans',
    'Ida',
    'Jonas',
    'Klara',
    'Leon',
    'Marie',
    'Noah',
    'Olivia',
    'Paul',
    'Sophie',
    'Tim',
    'Ursula',
    'Viktor',
    'Lisa',
    'Max',
    'Nina',
    'Otto',
  ]

  private static lastNames = [
    'Müller',
    'Schmidt',
    'Schneider',
    'Fischer',
    'Weber',
    'Meyer',
    'Wagner',
    'Becker',
    'Schulz',
    'Hoffmann',
    'Schäfer',
    'Koch',
    'Bauer',
    'Richter',
    'Klein',
    'Wolf',
    'Schröder',
    'Neumann',
    'Schwarz',
    'Zimmermann',
  ]

  private static businessNames = [
    'Café',
    'Restaurant',
    'Hotel',
    'Büro',
    'Praxis',
    'Kanzlei',
    'Agentur',
    'Studio',
    'Werkstatt',
    'Laden',
    'Markt',
    'Zentrum',
  ]

  private static businessTypes = [
    'Sonnenschein',
    'Adler',
    'Rose',
    'Stern',
    'Mond',
    'Berg',
    'See',
    'Park',
    'Garten',
    'Platz',
    'Hof',
    'Eck',
    'Punkt',
  ]

  /**
   * Generate a single user
   */
  static generateUser(options?: UserGeneratorOptions): User {
    const id = this.userIdCounter++
    const firstName = this.randomElement(this.firstNames)
    const lastName = this.randomElement(this.lastNames)
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@bakery.com`
    const role = options?.role || this.randomUserRole()

    const user: User = {
      id,
      email,
      firstName,
      lastName,
      role,
      isActive: options?.isActive ?? true,
      createdAt: this.randomPastDate(365).toISOString(),
      updatedAt: this.randomPastDate(30).toISOString(),
      lastLogin: this.randomPastDate(7).toISOString(),
      preferences: {
        theme: Math.random() > 0.5 ? 'light' : 'dark',
        language: 'de',
        notifications: Math.random() > 0.3,
        newsletter: Math.random() > 0.5,
      },
    }

    // Add role-specific fields as extended properties
    // These would be stored in a separate context or database in real app
    const extendedUser = user as any

    if (role === UserRole.Staff) {
      extendedUser.department = options?.department || 'Produktion'
      extendedUser.shift = Math.random() > 0.5 ? 'Frühschicht' : 'Spätschicht'
    }

    return user
  }

  /**
   * Generate multiple users
   */
  static generateUsers(count: number, options?: UserGeneratorOptions): User[] {
    const users: User[] = []

    for (let i = 0; i < count; i++) {
      users.push(this.generateUser(options))
    }

    return users
  }

  /**
   * Generate a team with various roles
   */
  static generateTeam(): User[] {
    const team: User[] = []

    // Manager
    team.push(this.generateUser({ role: UserRole.Manager }))

    // Staff members
    team.push(
      this.generateUser({ role: UserRole.Staff, department: 'Produktion' })
    )
    team.push(
      this.generateUser({ role: UserRole.Staff, department: 'Produktion' })
    )
    team.push(
      this.generateUser({ role: UserRole.Staff, department: 'Verkauf' })
    )
    team.push(
      this.generateUser({ role: UserRole.Staff, department: 'Verkauf' })
    )
    team.push(
      this.generateUser({ role: UserRole.Staff, department: 'Lieferung' })
    )

    return team
  }

  /**
   * Generate a single customer
   */
  static generateCustomer(options?: CustomerGeneratorOptions): Customer {
    const id = this.customerIdCounter++
    const type =
      options?.type || (Math.random() > 0.7 ? 'business' : 'individual')

    let firstName: string
    let lastName: string
    let email: string

    if (type === 'business') {
      const businessPrefix = this.randomElement(this.businessNames)
      const businessSuffix = this.randomElement(this.businessTypes)
      firstName = businessPrefix
      lastName = businessSuffix
      email = `info@${businessPrefix.toLowerCase()}-${businessSuffix.toLowerCase()}.de`
    } else {
      firstName = this.randomElement(this.firstNames)
      lastName = this.randomElement(this.lastNames)
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
    }

    const customer: Customer = {
      id,
      email,
      firstName,
      lastName,
      role: UserRole.Customer,
      isActive: options?.isActive ?? true,
      createdAt: this.randomPastDate(365).toISOString(),
      updatedAt: this.randomPastDate(30).toISOString(),
      lastLogin: this.randomPastDate(7).toISOString(),
      preferences: {
        theme: 'light' as const,
        language: 'de',
        notifications: Math.random() > 0.3,
        newsletter: Math.random() > 0.5,
      },
      loyaltyPoints: Math.floor(Math.random() * 1000),
      orderHistory: [],
    }

    // Add extended properties that aren't in the Customer type
    const extendedCustomer = customer as any
    extendedCustomer.customerId = `CUST-${String(id).padStart(3, '0')}`
    extendedCustomer.phone = `+49 ${Math.floor(Math.random() * 900) + 100} ${
      Math.floor(Math.random() * 9000000) + 1000000
    }`
    extendedCustomer.address = this.generateAddress()
    extendedCustomer.type = type
    extendedCustomer.totalOrders = Math.floor(Math.random() * 100) + 1
    extendedCustomer.totalSpent = 0
    extendedCustomer.averageOrderValue = 0
    extendedCustomer.lastOrderDate = this.randomPastDate(30)
    extendedCustomer.registeredAt = this.randomPastDate(365)
    extendedCustomer.favoriteProducts = this.generateFavoriteProducts()
    extendedCustomer.dietaryRestrictions = this.generateDietaryRestrictions()
    extendedCustomer.preferredPaymentMethod = this.randomPaymentMethod()
    extendedCustomer.preferredDeliveryTime = this.randomDeliveryTime()
    extendedCustomer.tags = this.generateCustomerTags(type)

    // Add business-specific fields
    if (type === 'business') {
      extendedCustomer.businessName = `${firstName} ${lastName}`
      extendedCustomer.taxId = `DE${
        Math.floor(Math.random() * 900000000) + 100000000
      }`
      extendedCustomer.contactPerson = `${this.randomElement(
        this.firstNames
      )} ${this.randomElement(this.lastNames)}`
      extendedCustomer.creditLimit = Math.floor(Math.random() * 10000) + 1000
      extendedCustomer.paymentTerms = [14, 30, 45, 60][
        Math.floor(Math.random() * 4)
      ]

      if (options?.businessType) {
        extendedCustomer.notes = `${options.businessType} Kunde`
      }
    } else {
      // Individual customer fields
      extendedCustomer.loyaltyCardNumber = `LC-${String(
        Math.floor(Math.random() * 9000000) + 1000000
      ).padStart(7, '0')}`
      extendedCustomer.birthDate = this.randomBirthDate()
    }

    // Calculate totals based on orders
    extendedCustomer.totalSpent =
      extendedCustomer.totalOrders * (20 + Math.random() * 80)
    extendedCustomer.averageOrderValue =
      extendedCustomer.totalSpent / extendedCustomer.totalOrders

    return customer
  }

  /**
   * Generate multiple customers
   */
  static generateCustomers(
    count: number,
    options?: CustomerGeneratorOptions
  ): Customer[] {
    const customers: Customer[] = []

    for (let i = 0; i < count; i++) {
      customers.push(this.generateCustomer(options))
    }

    return customers
  }

  // Helper methods
  private static randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }

  private static randomUserRole(): UserRole {
    const roles: UserRole[] = [
      UserRole.Admin,
      UserRole.Manager,
      UserRole.Staff,
      UserRole.Customer,
    ]
    const weights = [0.05, 0.15, 0.5, 0.3]

    const random = Math.random()
    let sum = 0

    for (let i = 0; i < roles.length; i++) {
      sum += weights[i]
      if (random < sum) return roles[i]
    }

    return UserRole.Staff
  }

  private static getPermissionsForRole(role: UserRole): string[] {
    const permissionMap: Record<string, string[]> = {
      [UserRole.Admin]: ['all'],
      [UserRole.Manager]: [
        'products.read',
        'products.write',
        'orders.read',
        'orders.write',
        'users.read',
        'users.write',
        'reports.read',
        'cash.read',
        'cash.write',
      ],
      [UserRole.Staff]: [
        'products.read',
        'orders.read',
        'inventory.read',
        'production.read',
        'production.write',
      ],
      [UserRole.Customer]: [
        'products.read',
        'orders.read.own',
        'orders.create',
        'profile.read.own',
        'profile.write.own',
      ],
    }

    return permissionMap[role] || []
  }

  private static getDepartmentForRole(role: UserRole): string {
    if (role === UserRole.Staff) {
      return ['Produktion', 'Verkauf', 'Lieferung'][
        Math.floor(Math.random() * 3)
      ]
    } else if (role === UserRole.Manager || role === UserRole.Admin) {
      return 'Verwaltung'
    }
    return 'Allgemein'
  }

  private static generateAddress() {
    const streets = [
      'Hauptstraße',
      'Marienplatz',
      'Leopoldstraße',
      'Sendlinger Straße',
      'Blumenstraße',
      'Schulstraße',
      'Bahnhofstraße',
      'Kirchstraße',
    ]

    const cities = ['München', 'Augsburg', 'Nürnberg', 'Regensburg']
    const postalCodes = ['80331', '80333', '80469', '80802', '81675']

    return {
      street: `${this.randomElement(streets)} ${
        Math.floor(Math.random() * 100) + 1
      }`,
      city: this.randomElement(cities),
      postalCode: this.randomElement(postalCodes),
      country: 'Deutschland',
    }
  }

  private static generateFavoriteProducts(): number[] {
    const productCount = Math.floor(Math.random() * 5) + 2
    const favorites: number[] = []

    for (let i = 0; i < productCount; i++) {
      favorites.push(Math.floor(Math.random() * 30) + 1)
    }

    return Array.from(new Set(favorites)) // Remove duplicates
  }

  private static generateDietaryRestrictions(): string[] {
    const restrictions = [
      'glutenfrei',
      'laktosefrei',
      'vegan',
      'nussfrei',
      'zuckerfrei',
    ]
    const count = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0
    const selected: string[] = []

    for (let i = 0; i < count; i++) {
      const restriction = this.randomElement(restrictions)
      if (!selected.includes(restriction)) {
        selected.push(restriction)
      }
    }

    return selected
  }

  private static randomPaymentMethod(): string {
    const methods = [
      'Bargeld',
      'EC-Karte',
      'Kreditkarte',
      'PayPal',
      'Rechnung',
      'Lastschrift',
    ]
    return this.randomElement(methods)
  }

  private static randomBirthDate(): string {
    const year = new Date().getFullYear() - Math.floor(Math.random() * 50) - 20
    const month = Math.floor(Math.random() * 12) + 1
    const day = Math.floor(Math.random() * 28) + 1
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
      2,
      '0'
    )}`
  }

  private static randomDeliveryTime(): string {
    const times = ['early-morning', 'morning', 'afternoon', 'evening']
    return this.randomElement(times)
  }

  private static generateCustomerTags(
    type: 'individual' | 'business'
  ): string[] {
    const tags: string[] = []

    if (type === 'business') {
      tags.push('B2B')
      if (Math.random() > 0.7) tags.push('Premium')
      if (Math.random() > 0.5) tags.push('Großkunde')
    } else {
      if (Math.random() > 0.6) tags.push('Stammkunde')
      if (Math.random() > 0.8) tags.push('VIP')
    }

    return tags
  }

  private static randomPastDate(daysAgo: number): Date {
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
    return date
  }
}
