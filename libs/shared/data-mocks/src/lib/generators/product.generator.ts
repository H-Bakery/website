/**
 * @fileoverview Product data generator for testing and development
 * @module @bakery/shared/data-mocks/generators
 */

import { Product, ProductCategory, ProductType } from '@bakery/shared/types'

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
      unit: options?.unit || (type === 'bread' ? 'g' : 'Stück'),
      dailyTarget: options?.dailyTarget || Math.floor(Math.random() * 30) + 10,
      bakingTime: options?.bakingTime || this.generateBakingTime(type),
      shelfLife: options?.shelfLife || this.generateShelfLife(type),
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
      type: 'seasonal' as ProductType,
      isActive: false,
      stock: 0,
      shelfLife: 14,
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
      category: 'Brot',
      type: 'bread',
      allergens: ['Gluten'],
      nutritionalInfo: {
        calories: 180 + Math.random() * 40,
        protein: 8 + Math.random() * 4,
        carbs: 25 + Math.random() * 10,
        fat: 1 + Math.random() * 2,
        fiber: 6 + Math.random() * 4,
        sugar: 1 + Math.random() * 2,
      },
    })
  }

  // Helper methods
  private static randomCategory(): ProductCategory {
    const categories: ProductCategory[] = [
      'Brot',
      'Brötchen',
      'Kuchen',
      'Torte',
      'Gebäck',
      'Snacks',
    ]
    return categories[Math.floor(Math.random() * categories.length)]
  }

  private static categoryToType(category: ProductCategory): ProductType {
    const mapping: Record<ProductCategory, ProductType> = {
      Brot: 'bread',
      Brötchen: 'bun',
      Kuchen: 'cake',
      Torte: 'cake',
      Gebäck: 'pastry',
      Snacks: 'snack',
    }
    return mapping[category] || 'bread'
  }

  private static generateName(category: ProductCategory): string {
    const names: Record<ProductCategory, string[]> = {
      Brot: ['Bauernbrot', 'Vollkornbrot', 'Roggenbrot', 'Weizenbrot'],
      Brötchen: ['Kaiserbrötchen', 'Mohnbrötchen', 'Sesambrötchen'],
      Kuchen: ['Marmorkuchen', 'Zitronenkuchen', 'Schokoladenkuchen'],
      Torte: ['Sahnetorte', 'Obsttorte', 'Mousse au Chocolat'],
      Gebäck: ['Schnecke', 'Plunder', 'Schweineöhrchen'],
      Snacks: ['Pizzastange', 'Käsestange', 'Wurstbrötchen'],
    }

    const categoryNames = names[category] || names['Brot']
    return categoryNames[Math.floor(Math.random() * categoryNames.length)]
  }

  private static generateDescription(category: ProductCategory): string {
    const prefix = 'Frisch gebacken, '
    const suffixes: Record<ProductCategory, string[]> = {
      Brot: [
        'mit knuspriger Kruste',
        'saftig und aromatisch',
        'nach traditionellem Rezept',
      ],
      Brötchen: [
        'goldbraun gebacken',
        'luftig und leicht',
        'perfekt zum Frühstück',
      ],
      Kuchen: ['süß und saftig', 'mit feinen Zutaten', 'wie bei Oma'],
      Torte: [
        'cremig und köstlich',
        'kunstvoll verziert',
        'ein Genuss für besondere Anlässe',
      ],
      Gebäck: ['buttrig und blättrig', 'zart schmelzend', 'handgefertigt'],
      Snacks: [
        'herzhaft und würzig',
        'ideal für zwischendurch',
        'knusprig gebacken',
      ],
    }

    const categorySuffixes = suffixes[category] || suffixes['Brot']
    return (
      prefix +
      categorySuffixes[Math.floor(Math.random() * categorySuffixes.length)]
    )
  }

  private static generatePrice(type: ProductType): number {
    const priceRanges: Record<ProductType, [number, number]> = {
      bread: [2.0, 5.0],
      bun: [0.4, 2.0],
      cake: [2.5, 5.0],
      pastry: [1.5, 3.5],
      snack: [1.0, 3.0],
      seasonal: [3.0, 15.0],
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
      bread: ['Mehl', 'Wasser', 'Salz', 'Hefe'],
      bun: ['Weizenmehl', 'Wasser', 'Hefe', 'Salz'],
      cake: ['Mehl', 'Zucker', 'Butter', 'Eier'],
      pastry: ['Mehl', 'Butter', 'Zucker'],
      snack: ['Mehl', 'Wasser', 'Salz'],
      seasonal: ['Mehl', 'Zucker', 'Gewürze'],
    }

    return baseIngredients[type] || baseIngredients['bread']
  }

  private static generateNutritionalInfo(
    type: ProductType
  ): Product['nutritionalInfo'] {
    const baseValues: Record<ProductType, Product['nutritionalInfo']> = {
      bread: {
        calories: 250,
        protein: 8,
        carbs: 45,
        fat: 2,
        fiber: 5,
        sugar: 3,
      },
      bun: {
        calories: 150,
        protein: 5,
        carbs: 30,
        fat: 1.5,
        fiber: 2,
        sugar: 2,
      },
      cake: {
        calories: 350,
        protein: 4,
        carbs: 40,
        fat: 18,
        fiber: 1,
        sugar: 25,
      },
      pastry: {
        calories: 300,
        protein: 4,
        carbs: 35,
        fat: 16,
        fiber: 1,
        sugar: 15,
      },
      snack: {
        calories: 200,
        protein: 6,
        carbs: 30,
        fat: 6,
        fiber: 2,
        sugar: 3,
      },
      seasonal: {
        calories: 400,
        protein: 5,
        carbs: 60,
        fat: 15,
        fiber: 2,
        sugar: 35,
      },
    }

    const base = baseValues[type] || baseValues['bread']

    // Add some variation
    return {
      calories: base.calories + Math.random() * 50 - 25,
      protein: base.protein + Math.random() * 2 - 1,
      carbs: base.carbs + Math.random() * 10 - 5,
      fat: base.fat + Math.random() * 4 - 2,
      fiber: base.fiber + Math.random() * 2 - 1,
      sugar: base.sugar + Math.random() * 5 - 2.5,
    }
  }

  private static generateWeight(type: ProductType): number {
    const weightRanges: Record<ProductType, [number, number]> = {
      bread: [500, 1000],
      bun: [50, 100],
      cake: [100, 200],
      pastry: [60, 120],
      snack: [80, 150],
      seasonal: [100, 1000],
    }

    const [min, max] = weightRanges[type] || [50, 200]
    return Math.floor(this.randomInRange(min, max))
  }

  private static generateBakingTime(type: ProductType): string {
    const times: Record<ProductType, string[]> = {
      bread: ['04:00', '05:00', '06:00'],
      bun: ['03:30', '04:00', '04:30'],
      cake: ['06:00', '07:00', '08:00'],
      pastry: ['05:00', '05:30', '06:00'],
      snack: ['04:30', '05:00', '05:30'],
      seasonal: ['07:00', '08:00', '09:00'],
    }

    const typeTimes = times[type] || times['bread']
    return typeTimes[Math.floor(Math.random() * typeTimes.length)]
  }

  private static generateShelfLife(type: ProductType): number {
    const shelfLifeRanges: Record<ProductType, [number, number]> = {
      bread: [2, 5],
      bun: [1, 2],
      cake: [2, 4],
      pastry: [1, 3],
      snack: [1, 2],
      seasonal: [7, 30],
    }

    const [min, max] = shelfLifeRanges[type] || [1, 3]
    return Math.floor(this.randomInRange(min, max))
  }

  private static randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min
  }
}
