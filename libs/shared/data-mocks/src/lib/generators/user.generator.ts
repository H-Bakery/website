/**
 * @fileoverview User and customer data generator for testing and development
 * @module @bakery/shared/data-mocks/generators
 */

import { User, UserRole, Customer, CustomerType } from '@bakery/shared/types'

interface UserGeneratorOptions {
  role?: UserRole
  isActive?: boolean
  department?: string
}

interface CustomerGeneratorOptions {
  type?: CustomerType
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
    const name = `${firstName} ${lastName}`
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`
    const email = `${username}@bakery.com`
    const role = options?.role || this.randomUserRole()

    const user: User = {
      id,
      username,
      email,
      role,
      name,
      isActive: options?.isActive ?? true,
      permissions: this.getPermissionsForRole(role),
      createdAt: this.randomPastDate(365),
      updatedAt: this.randomPastDate(30),
      lastLogin: this.randomPastDate(7),
      preferences: {
        theme: Math.random() > 0.5 ? 'light' : 'dark',
        language: 'de',
        notifications: {
          email: Math.random() > 0.3,
          push: Math.random() > 0.4,
          sms: Math.random() > 0.7,
        },
      },
    }

    // Add role-specific fields
    if (role === 'baker' || role === 'cashier' || role === 'delivery') {
      user.department = options?.department || this.getDepartmentForRole(role)

      if (role === 'baker') {
        user.shift = Math.random() > 0.5 ? 'Frühschicht' : 'Spätschicht'
      } else if (role === 'delivery') {
        user.vehicleId = `BAK-${String(
          Math.floor(Math.random() * 10) + 1
        ).padStart(3, '0')}`
      }
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
    team.push(this.generateUser({ role: 'manager' }))

    // Bakers
    team.push(this.generateUser({ role: 'baker', department: 'Produktion' }))
    team.push(this.generateUser({ role: 'baker', department: 'Produktion' }))

    // Cashiers
    team.push(this.generateUser({ role: 'cashier', department: 'Verkauf' }))
    team.push(this.generateUser({ role: 'cashier', department: 'Verkauf' }))

    // Delivery
    team.push(this.generateUser({ role: 'delivery', department: 'Lieferung' }))

    return team
  }

  /**
   * Generate a single customer
   */
  static generateCustomer(options?: CustomerGeneratorOptions): Customer {
    const id = this.customerIdCounter++
    const type =
      options?.type || (Math.random() > 0.7 ? 'business' : 'individual')

    let name: string
    let email: string
    let businessName: string | undefined

    if (type === 'business') {
      const businessPrefix = this.randomElement(this.businessNames)
      const businessSuffix = this.randomElement(this.businessTypes)
      businessName = `${businessPrefix} ${businessSuffix}`
      name = businessName
      email = `info@${businessPrefix.toLowerCase()}-${businessSuffix.toLowerCase()}.de`
    } else {
      const firstName = this.randomElement(this.firstNames)
      const lastName = this.randomElement(this.lastNames)
      name = `${firstName} ${lastName}`
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
    }

    const customer: Customer = {
      id,
      customerId: `CUST-${String(id).padStart(3, '0')}`,
      name,
      email,
      phone: `+49 ${Math.floor(Math.random() * 900) + 100} ${
        Math.floor(Math.random() * 9000000) + 1000000
      }`,
      address: this.generateAddress(),
      type,
      isActive: options?.isActive ?? true,
      totalOrders: Math.floor(Math.random() * 100) + 1,
      totalSpent: 0, // Will be calculated
      averageOrderValue: 0, // Will be calculated
      lastOrderDate: this.randomPastDate(30),
      registeredAt: this.randomPastDate(365),
      preferences: {
        newsletter: Math.random() > 0.3,
        smsNotifications: Math.random() > 0.7,
        favoriteProducts: this.generateFavoriteProducts(),
        dietaryRestrictions: this.generateDietaryRestrictions(),
        preferredPaymentMethod: this.randomPaymentMethod(),
        preferredDeliveryTime: this.randomDeliveryTime(),
      },
      tags: this.generateCustomerTags(type),
    }

    // Add business-specific fields
    if (type === 'business') {
      customer.businessName = businessName
      customer.taxId = `DE${Math.floor(Math.random() * 900000000) + 100000000}`
      customer.contactPerson = `${this.randomElement(
        this.firstNames
      )} ${this.randomElement(this.lastNames)}`
      customer.creditLimit = Math.floor(Math.random() * 10000) + 1000
      customer.paymentTerms = [14, 30, 45, 60][Math.floor(Math.random() * 4)]

      if (options?.businessType) {
        customer.notes = `${options.businessType} Kunde`
      }
    } else {
      customer.loyaltyPoints = Math.floor(Math.random() * 500)
    }

    // Calculate spent and average
    customer.totalSpent = customer.totalOrders * (20 + Math.random() * 80)
    customer.averageOrderValue = customer.totalSpent / customer.totalOrders

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
      'admin',
      'manager',
      'baker',
      'cashier',
      'delivery',
      'customer',
    ]
    const weights = [0.05, 0.1, 0.3, 0.25, 0.15, 0.15]

    const random = Math.random()
    let sum = 0

    for (let i = 0; i < roles.length; i++) {
      sum += weights[i]
      if (random < sum) return roles[i]
    }

    return 'baker'
  }

  private static getPermissionsForRole(role: UserRole): string[] {
    const permissionMap: Record<UserRole, string[]> = {
      admin: ['all'],
      manager: [
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
      baker: [
        'products.read',
        'orders.read',
        'inventory.read',
        'production.read',
        'production.write',
      ],
      cashier: [
        'products.read',
        'orders.read',
        'orders.create',
        'cash.read',
        'cash.write',
        'customer.read',
      ],
      delivery: [
        'orders.read',
        'orders.update',
        'delivery.read',
        'delivery.write',
        'customer.read',
      ],
      customer: [
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
    const departmentMap: Record<string, string> = {
      baker: 'Produktion',
      cashier: 'Verkauf',
      delivery: 'Lieferung',
    }

    return departmentMap[role] || 'Verwaltung'
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

    return [...new Set(favorites)] // Remove duplicates
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

  private static randomDeliveryTime(): string {
    const times = ['early-morning', 'morning', 'afternoon', 'evening']
    return this.randomElement(times)
  }

  private static generateCustomerTags(type: CustomerType): string[] {
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
