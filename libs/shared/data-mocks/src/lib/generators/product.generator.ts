/**
 * @fileoverview Product data generator for testing and development
 * @module @bakery/shared/data-mocks/generators
 */

import {
  Product,
  ProductCategory,
  ProductType,
  ProductStatus,
} from '@bakery/shared/types'

interface ProductGeneratorOptions {
  category?: ProductCategory
  type?: ProductType
  priceRange?: { min: number; max: number }
  isActive?: boolean
  count?: number
}

/**
 * Generate random product data
 */
export class ProductGenerator {
  private static idCounter = 1000

  /**
   * Generate a single product
   */
  static generateProduct(options?: Partial<Product>): Product {
    const id = options?.id || this.idCounter++
    const category = options?.category || this.randomCategory()
    const type = options?.type || this.categoryToType(category)

    return {
      id,
      name: options?.name || this.generateName(category),
      description: options?.description || this.generateDescription(category),
      category,
      type,
      image: options?.image || `/assets/images/products/Type=${type}.svg`,
      price: options?.price || this.generatePrice(type),
      isActive: options?.isActive ?? true,
      stock: options?.stock || Math.floor(Math.random() * 50) + 10,
      allergens: options?.allergens || this.generateAllergens(type),
      ingredients: options?.ingredients || this.generateIngredients(type),
      nutritionalInfo:
        options?.nutritionalInfo || this.generateNutritionalInfo(type),
      weight: options?.weight || this.generateWeight(type),
      unit: options?.unit || (type === ProductType.Fresh ? 'g' : 'Stück'),
      dailyTarget: options?.dailyTarget || Math.floor(Math.random() * 30) + 10,
      status:
        options?.status ||
        (options?.isActive === false
          ? ProductStatus.OutOfStock
          : ProductStatus.Available),
      createdAt: options?.createdAt || new Date().toISOString(),
      updatedAt: options?.updatedAt || new Date().toISOString(),
      // bakingTime and shelfLife are internal properties, not part of Product interface
    }
  }

  /**
   * Generate multiple products
   */
  static generateProducts(options: ProductGeneratorOptions = {}): Product[] {
    const count = options.count || 10
    const products: Product[] = []

    for (let i = 0; i < count; i++) {
      const product = this.generateProduct({
        category: options.category,
        type: options.type,
        isActive: options.isActive,
        price: options.priceRange
          ? this.randomInRange(options.priceRange.min, options.priceRange.max)
          : undefined,
      })
      products.push(product)
    }

    return products
  }

  /**
   * Generate product with specific characteristics
   */
  static generateSeasonalProduct(): Product {
    const seasonalProducts = ['Lebkuchen', 'Stollen', 'Osterlamm', 'Osterzopf']
    const name =
      seasonalProducts[Math.floor(Math.random() * seasonalProducts.length)]

    return this.generateProduct({
      name,
      type: ProductType.Seasonal,
      isActive: false,
      stock: 0,
      // shelfLife: 14 - not part of Product interface
    })
  }

  static generateHealthyProduct(): Product {
    const healthyNames = [
      'Vollkornbrot',
      'Dinkelbrot',
      'Haferbrot',
      'Eiweißbrot',
    ]
    const name = healthyNames[Math.floor(Math.random() * healthyNames.length)]

    return this.generateProduct({
      name: `Bio ${name}`,
      category: ProductCategory.Bread,
      type: ProductType.Fresh,
      allergens: ['Gluten'],
      nutritionalInfo: {
        calories: 180 + Math.random() * 40,
        protein: 8 + Math.random() * 4,
        carbohydrates: 25 + Math.random() * 10,
        fat: 1 + Math.random() * 2,
        fiber: 6 + Math.random() * 4,
        sugar: 1 + Math.random() * 2,
      },
    })
  }

  // Helper methods
  private static randomCategory(): ProductCategory {
    const categories: ProductCategory[] = [
      ProductCategory.Bread,
      ProductCategory.Buns,
      ProductCategory.Cakes,
      ProductCategory.SpecialCakes,
      ProductCategory.Pastries,
      ProductCategory.Snacks,
    ]
    return categories[Math.floor(Math.random() * categories.length)]
  }

  private static categoryToType(category: ProductCategory): ProductType {
    // Map categories to available ProductType values
    return ProductType.Fresh // Default all bakery items to Fresh
  }

  private static generateName(category: ProductCategory): string {
    const names: Record<ProductCategory, string[]> = {
      [ProductCategory.Bread]: [
        'Bauernbrot',
        'Vollkornbrot',
        'Roggenbrot',
        'Weizenbrot',
      ],
      [ProductCategory.Buns]: [
        'Kaiserbrötchen',
        'Mohnbrötchen',
        'Sesambrötchen',
      ],
      [ProductCategory.Cakes]: [
        'Marmorkuchen',
        'Zitronenkuchen',
        'Schokoladenkuchen',
      ],
      [ProductCategory.SpecialCakes]: [
        'Sahnetorte',
        'Obsttorte',
        'Mousse au Chocolat',
      ],
      [ProductCategory.Pastries]: ['Schnecke', 'Plunder', 'Schweineöhrchen'],
      [ProductCategory.Snacks]: ['Pizzastange', 'Käsestange', 'Wurstbrötchen'],
      [ProductCategory.Beverages]: ['Kaffee', 'Tee', 'Saft'],
    }

    const categoryNames = names[category] || names[ProductCategory.Bread]
    return categoryNames[Math.floor(Math.random() * categoryNames.length)]
  }

  private static generateDescription(category: ProductCategory): string {
    const prefix = 'Frisch gebacken, '
    const suffixes: Record<ProductCategory, string[]> = {
      [ProductCategory.Bread]: [
        'mit knuspriger Kruste',
        'saftig und aromatisch',
        'nach traditionellem Rezept',
      ],
      [ProductCategory.Buns]: [
        'goldbraun gebacken',
        'luftig und leicht',
        'perfekt zum Frühstück',
      ],
      [ProductCategory.Cakes]: [
        'süß und saftig',
        'mit feinen Zutaten',
        'wie bei Oma',
      ],
      [ProductCategory.SpecialCakes]: [
        'cremig und köstlich',
        'kunstvoll verziert',
        'ein Genuss für besondere Anlässe',
      ],
      [ProductCategory.Pastries]: [
        'buttrig und blättrig',
        'zart schmelzend',
        'handgefertigt',
      ],
      [ProductCategory.Snacks]: [
        'herzhaft und würzig',
        'ideal für zwischendurch',
        'knusprig gebacken',
      ],
      [ProductCategory.Beverages]: ['erfrischend', 'köstlich', 'hochwertig'],
    }

    const categorySuffixes =
      suffixes[category] || suffixes[ProductCategory.Bread]
    return (
      prefix +
      categorySuffixes[Math.floor(Math.random() * categorySuffixes.length)]
    )
  }

  private static generatePrice(type: ProductType): number {
    const priceRanges: Record<ProductType, [number, number]> = {
      [ProductType.Fresh]: [2.0, 5.0],
      [ProductType.Frozen]: [1.5, 4.0],
      [ProductType.Packaged]: [1.0, 3.0],
      [ProductType.Seasonal]: [3.0, 15.0],
    }

    const [min, max] = priceRanges[type] || [1.0, 5.0]
    return this.randomInRange(min, max)
  }

  private static generateAllergens(type: ProductType): string[] {
    const commonAllergens = ['Gluten']
    const possibleAllergens = ['Milch', 'Ei', 'Nüsse', 'Sesam', 'Soja']

    const allergenCount = Math.floor(Math.random() * 3)
    const selectedAllergens = [...commonAllergens]

    for (let i = 0; i < allergenCount; i++) {
      const allergen =
        possibleAllergens[Math.floor(Math.random() * possibleAllergens.length)]
      if (!selectedAllergens.includes(allergen)) {
        selectedAllergens.push(allergen)
      }
    }

    return selectedAllergens
  }

  private static generateIngredients(type: ProductType): string[] {
    const baseIngredients: Record<ProductType, string[]> = {
      [ProductType.Fresh]: ['Mehl', 'Wasser', 'Salz', 'Hefe'],
      [ProductType.Frozen]: ['Mehl', 'Wasser', 'Hefe', 'Salz'],
      [ProductType.Packaged]: ['Mehl', 'Zucker', 'Butter', 'Eier'],
      [ProductType.Seasonal]: ['Mehl', 'Zucker', 'Gewürze'],
    }

    return baseIngredients[type] || baseIngredients[ProductType.Fresh]
  }

  private static generateNutritionalInfo(
    type: ProductType
  ): Product['nutritionalInfo'] {
    const baseValues: Record<ProductType, Product['nutritionalInfo']> = {
      [ProductType.Fresh]: {
        calories: 250,
        protein: 8,
        carbohydrates: 45,
        fat: 2,
        fiber: 5,
        sugar: 3,
      },
      [ProductType.Frozen]: {
        calories: 200,
        protein: 6,
        carbohydrates: 35,
        fat: 4,
        fiber: 3,
        sugar: 4,
      },
      [ProductType.Packaged]: {
        calories: 300,
        protein: 5,
        carbohydrates: 40,
        fat: 12,
        fiber: 2,
        sugar: 15,
      },
      [ProductType.Seasonal]: {
        calories: 400,
        protein: 5,
        carbohydrates: 60,
        fat: 15,
        fiber: 2,
        sugar: 35,
      },
    }

    const base = baseValues[type] ||
      baseValues[ProductType.Fresh] || {
        calories: 250,
        protein: 6,
        carbohydrates: 40,
        fat: 5,
        fiber: 3,
        sugar: 10,
      }

    // Add some variation
    return {
      calories: base.calories + Math.random() * 50 - 25,
      protein: base.protein + Math.random() * 2 - 1,
      carbohydrates: base.carbohydrates + Math.random() * 10 - 5,
      fat: base.fat + Math.random() * 4 - 2,
      fiber: base.fiber! + Math.random() * 2 - 1,
      sugar: base.sugar! + Math.random() * 5 - 2.5,
    }
  }

  private static generateWeight(type: ProductType): number {
    const weightRanges: Record<ProductType, [number, number]> = {
      [ProductType.Fresh]: [50, 1000],
      [ProductType.Frozen]: [100, 500],
      [ProductType.Packaged]: [50, 200],
      [ProductType.Seasonal]: [100, 1000],
    }

    const [min, max] = weightRanges[type] || [50, 200]
    return Math.floor(this.randomInRange(min, max))
  }

  private static generateBakingTime(type: ProductType): string {
    const times: Record<ProductType, string[]> = {
      [ProductType.Fresh]: ['04:00', '05:00', '06:00'],
      [ProductType.Frozen]: ['03:30', '04:00', '04:30'],
      [ProductType.Packaged]: ['05:00', '05:30', '06:00'],
      [ProductType.Seasonal]: ['07:00', '08:00', '09:00'],
    }

    const typeTimes = times[type] || times[ProductType.Fresh]
    return typeTimes[Math.floor(Math.random() * typeTimes.length)]
  }

  private static generateShelfLife(type: ProductType): number {
    const shelfLifeRanges: Record<ProductType, [number, number]> = {
      [ProductType.Fresh]: [1, 3],
      [ProductType.Frozen]: [30, 90],
      [ProductType.Packaged]: [7, 30],
      [ProductType.Seasonal]: [7, 30],
    }

    const [min, max] = shelfLifeRanges[type] || [1, 3]
    return Math.floor(this.randomInRange(min, max))
  }

  private static randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min
  }
}
