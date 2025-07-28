import { PrepSection, BakingItem, PrepTaskItem, PrepIngredient } from '../types/prepTask'
import { MarkdownParser } from './markdownParser'

interface PrepConfig {
  pastry_cart: {
    description: string
    instructions: string
    final_step: string
    items: Array<{
      name: string
      quantity: number
      tray_number?: number
      tray_numbers?: number[]
      trays_of?: number
    }>
  }
  sourdough: {
    variants: {
      [key: string]: {
        description: string
        ingredients: PrepIngredient[]
        instructions: string[]
      }
    }
  }
  bruehstueck?: {
    variants: {
      [key: string]: {
        description: string
        ingredients: PrepIngredient[]
        instructions: string[]
      }
    }
  }
  meatloaf: {
    description: string
    instructions: string[]
  }
  standard_baking: {
    cakes: Array<{
      name: string
      standard_quantity: number
      note?: string
    }>
    bread: Array<{
      name: string
      standard_quantity: number
      unit: string
    }>
  }
}

export class PrepTaskLoader {
  private static config: PrepConfig | null = null

  private static async loadConfig(): Promise<PrepConfig> {
    if (this.config) return this.config

    // In a real implementation, this would fetch from the backend
    // For now, using the parsed YAML structure
    this.config = {
      pastry_cart: {
        description: "Items to be removed from freezer and arranged on the Kaffeestückchen Wagen cart",
        instructions: "All items must be placed on trays with protective foil",
        final_step: "Push cart into retarder and set to program A",
        items: [
          { name: "Schokocroissant", quantity: 10, tray_number: 1 },
          { name: "Croissant", quantity: 12, tray_number: 2 },
          { name: "Schoko-Vanille Hörnchen", quantity: 7, tray_number: 3 },
          { name: "Quarktaschen", quantity: 7, tray_number: 4 },
          { name: "Nusschnecke", quantity: 6, tray_number: 5 },
          { name: "Pudding Schnecke", quantity: 6, tray_number: 5 },
          { name: "Pudding Plunder", quantity: 7, tray_number: 6 },
          { name: "Kirschtaschen", quantity: 7, tray_number: 7 },
          { name: "Apfeltaschen", quantity: 7, tray_number: 7 },
          { name: "Franzbrötchen", quantity: 5, tray_number: 8 },
          { name: "Marzipanschleifen", quantity: 6, tray_number: 9 },
          { name: "Laugenstangen", quantity: 8, tray_number: 10 },
          { name: "Einback", quantity: 15, trays_of: 5, tray_numbers: [11, 12, 13] },
          { name: "Streusel", quantity: 8, tray_number: 14 },
          { name: "Nougatplunder", quantity: 36, trays_of: 12, tray_numbers: [15, 16, 17] }
        ]
      },
      sourdough: {
        variants: {
          mischbrot: {
            description: "For 3 liters of Mischbrot (mixed bread)",
            ingredients: [
              { name: "Starter culture", quantity: 28, unit: "g" },
              { name: "Water", quantity: 188, unit: "g" },
              { name: "Wheat flour", quantity: 378, unit: "g" }
            ],
            instructions: [
              "Mix ingredients quickly until a dough ball forms",
              "Remove dough from bowl and knead slowly until smooth", 
              "Place in small, clean container",
              "Store in small proofing cabinet (27°C for 599 minutes - extended fermentation)"
            ]
          },
          buttermilchbrot: {
            description: "For Buttermilchbrot (Weizensauerteig)",
            ingredients: [
              { name: "Starter culture", quantity: 28, unit: "g" },
              { name: "Water", quantity: 188, unit: "g" },
              { name: "Wheat flour", quantity: 378, unit: "g" }
            ],
            instructions: [
              "Mix ingredients quickly until a dough ball forms",
              "Remove dough from bowl and knead slowly until smooth",
              "Place in small, clean container", 
              "Store in small proofing cabinet (27°C for 599 minutes - extended fermentation)"
            ]
          }
        }
      },
      bruehstueck: {
        variants: {
          vollgut: {
            description: "Pre-scald for Vollgut Brot",
            ingredients: [
              { name: "Sunflower seeds", quantity: 400, unit: "g" },
              { name: "Flaxseed", quantity: 400, unit: "g" },
              { name: "Boiling water", quantity: 800, unit: "ml" }
            ],
            instructions: [
              "Place seeds in heat-resistant container",
              "Pour boiling water over the seeds",
              "Stir to ensure all seeds are fully soaked",
              "Cover and let sit until used in the morning"
            ]
          }
        }
      },
      meatloaf: {
        description: "Meatloaf preparation for next day",
        instructions: [
          "Grease GN container",
          "Remove meatloaf in casing from freezer (located in tray on small scale)",
          "Score skin, then remove casing",
          "Place in container without lid",
          "Place in small oven and set to 105°C"
        ]
      },
      standard_baking: {
        cakes: [
          { name: "Marmorkuchen", standard_quantity: 3 },
          { name: "Sahnetorte", standard_quantity: 3 },
          { name: "Käsekuchen mit Mandarinen", standard_quantity: 2 },
          { name: "Kirsch-Streuselkuchen", standard_quantity: 2, note: "für nächsten Tag, 06:30" }
        ],
        bread: [
          { name: "Kornbrot", standard_quantity: 6, unit: "Liter" },
          { name: "Holzlukenbrot", standard_quantity: 6, unit: "Liter" }
        ]
      }
    }

    return this.config
  }

  private static applyStockStatus(items: PrepTaskItem[]): PrepTaskItem[] {
    // Simulate stock levels based on item name
    return items.map(item => {
      const stockStatuses: Array<'sufficient' | 'low' | 'critical' | 'empty'> = ['sufficient', 'low', 'critical', 'empty']
      const stockWeights = [0.6, 0.25, 0.1, 0.05] // Most items sufficient, some low/critical/empty
      
      // Use item name hash to create consistent stock status
      const hash = item.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const index = hash % stockStatuses.length
      
      // Apply weighted selection biased towards sufficient stock
      let stockIndex = 0
      const random = (hash * 7) % 100 / 100
      let cumulative = 0
      for (let i = 0; i < stockWeights.length; i++) {
        cumulative += stockWeights[i]
        if (random <= cumulative) {
          stockIndex = i
          break
        }
      }
      
      const status = stockStatuses[stockIndex]
      const minStock = 5
      const currentStock = status === 'sufficient' ? 15 : 
                          status === 'low' ? 3 :
                          status === 'critical' ? 1 : 0

      return {
        ...item,
        stock_status: status,
        current_stock: currentStock,
        min_stock_level: minStock,
        completed: false
      }
    })
  }

  public static async generatePrepTasksForDate(prepDate: Date): Promise<PrepSection[]> {
    const config = await this.loadConfig()
    
    // Get the production day (tomorrow from prep date)
    const productionDate = new Date(prepDate)
    productionDate.setDate(productionDate.getDate() + 1)
    const productionDayOfWeek = productionDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Apply day-specific variations based on PRODUCTION day
    const dayVariations = this.getDayVariations(productionDayOfWeek)
    
    const sections: PrepSection[] = []

    // 1. Pastry Cart Setup
    const pastryItems: PrepTaskItem[] = config.pastry_cart.items.map(item => ({
      name: item.name,
      quantity: this.applyVariation(item.quantity, dayVariations.pastry),
      tray_number: item.tray_number,
      tray_numbers: item.tray_numbers,
      trays_of: item.trays_of,
      completed: false
    }))

    sections.push({
      name: 'Teigwaren-Aufbereitung',
      description: config.pastry_cart.description,
      instructions: [config.pastry_cart.instructions],
      final_step: config.pastry_cart.final_step,
      items: this.applyStockStatus(pastryItems),
      completed: false
    })

    // 2. Sourdough Preparation
    const sourdoughVariant = this.getSourdoughVariant(productionDayOfWeek)
    if (config.sourdough.variants[sourdoughVariant]) {
      const variant = config.sourdough.variants[sourdoughVariant]
      sections.push({
        name: 'Sauerteig-Vorbereitung',
        description: variant.description,
        ingredients: variant.ingredients,
        instructions: variant.instructions,
        completed: false
      })
    }

    // 3. Brühstück if needed
    if (this.needsBruehstueck(productionDayOfWeek) && config.bruehstueck) {
      const variant = config.bruehstueck.variants.vollgut
      sections.push({
        name: 'Brühstück-Vorbereitung',
        description: variant.description,
        ingredients: variant.ingredients,
        instructions: variant.instructions,
        completed: false
      })
    }

    // 4. Meatloaf (certain days)
    if (this.needsMeatloaf(productionDayOfWeek)) {
      sections.push({
        name: 'Leberkäse-Vorbereitung',
        description: config.meatloaf.description,
        instructions: config.meatloaf.instructions,
        completed: false
      })
    }

    return sections
  }

  public static async getBakingScheduleForDate(prepDate: Date): Promise<{ cakes: BakingItem[], bread: BakingItem[] }> {
    const config = await this.loadConfig()
    
    // Get the production day (tomorrow from prep date)
    const productionDate = new Date(prepDate)
    productionDate.setDate(productionDate.getDate() + 1)
    const productionDayOfWeek = productionDate.getDay()
    const dayVariations = this.getDayVariations(productionDayOfWeek)

    // Add daily bread variations
    const dailyBreads = this.getDailyBreadVariations(productionDayOfWeek)
    const allBreads = [
      ...config.standard_baking.bread.map(item => ({
        name: item.name,
        standard_quantity: item.standard_quantity,
        unit: item.unit,
        quantity: this.applyVariation(item.standard_quantity, dayVariations.bread)
      })),
      ...dailyBreads
    ]

    return {
      cakes: config.standard_baking.cakes.map(item => ({
        name: item.name,
        standard_quantity: item.standard_quantity,
        quantity: this.applyVariation(item.standard_quantity, dayVariations.cakes),
        note: item.note
      })),
      bread: allBreads
    }
  }

  private static getDayVariations(dayOfWeek: number): { pastry: number, cakes: number, bread: number } {
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    switch (dayOfWeek) {
      case 0: // Sunday - closed, prep for Monday
        return { pastry: 0.7, cakes: 0.8, bread: 0.8 }
      case 1: // Monday - lower demand
        return { pastry: 0.8, cakes: 0.9, bread: 0.9 }
      case 2: // Tuesday - normal
        return { pastry: 1.0, cakes: 1.0, bread: 1.0 }
      case 3: // Wednesday - slightly reduced (from the example file)
        return { pastry: 0.9, cakes: 1.0, bread: 1.0 }
      case 4: // Thursday - normal
        return { pastry: 1.0, cakes: 1.0, bread: 1.0 }
      case 5: // Friday - higher demand
        return { pastry: 1.2, cakes: 1.1, bread: 1.1 }
      case 6: // Saturday - highest demand
        return { pastry: 1.3, cakes: 1.2, bread: 1.2 }
      default:
        return { pastry: 1.0, cakes: 1.0, bread: 1.0 }
    }
  }

  private static applyVariation(baseQuantity: number, multiplier: number): number {
    return Math.round(baseQuantity * multiplier)
  }

  private static getSourdoughVariant(dayOfWeek: number): string {
    // Alternate between variants based on day
    return dayOfWeek % 2 === 0 ? 'mischbrot' : 'buttermilchbrot'
  }

  private static needsBruehstueck(dayOfWeek: number): boolean {
    // Brühstück needed for Vollgut bread on specific days
    return dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6 // Tuesday, Thursday, Saturday
  }

  private static needsMeatloaf(dayOfWeek: number): boolean {
    // Meatloaf preparation on certain days
    return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5 // Monday, Wednesday, Friday
  }

  private static getDailyBreadVariations(dayOfWeek: number): BakingItem[] {
    const variations: BakingItem[] = []
    
    switch (dayOfWeek) {
      case 1: // Monday
        variations.push(
          { name: "Mischbrot", standard_quantity: 3, unit: "Liter", quantity: 3 },
          { name: "Haferbrot", standard_quantity: 1.5, unit: "Liter", quantity: 1.5 }
        )
        break
      case 2: // Tuesday  
        variations.push(
          { name: "Vollgut Brot", standard_quantity: 2, unit: "Liter", quantity: 2 },
          { name: "Buttermilchbrot", standard_quantity: 3, unit: "Liter", quantity: 3 }
        )
        break
      case 3: // Wednesday
        variations.push(
          { name: "Mischbrot", standard_quantity: 3, unit: "Liter", quantity: 3 },
          { name: "Roggenbrot", standard_quantity: 2, unit: "Liter", quantity: 2 }
        )
        break
      case 4: // Thursday
        variations.push(
          { name: "Haferbrot", standard_quantity: 1.5, unit: "Liter", quantity: 1.5 },
          { name: "Dinkelwrappenbrot", standard_quantity: 2, unit: "Liter", quantity: 2 }
        )
        break
      case 5: // Friday
        variations.push(
          { name: "Buttermilchbrot", standard_quantity: 3, unit: "Liter", quantity: 3 },
          { name: "Vollgut Brot", standard_quantity: 2, unit: "Liter", quantity: 2 },
          { name: "Mischbrot", standard_quantity: 4, unit: "Liter", quantity: 4 }
        )
        break
      case 6: // Saturday
        variations.push(
          { name: "Mischbrot", standard_quantity: 4, unit: "Liter", quantity: 4 },
          { name: "Vollgut Brot", standard_quantity: 3, unit: "Liter", quantity: 3 },
          { name: "Roggenbrot", standard_quantity: 2, unit: "Liter", quantity: 2 }
        )
        break
      case 0: // Sunday (closed, prep for Monday)
        variations.push(
          { name: "Mischbrot", standard_quantity: 2, unit: "Liter", quantity: 2 }
        )
        break
    }
    
    return variations
  }

  public static async loadSpecificDate(dateString: string): Promise<PrepSection[] | null> {
    // Try to load a specific markdown file for this date
    // Format: YYYY-MM-DD-prep-for-[day].md
    
    try {
      // Check if we have the specific Wednesday file (hardcoded for demo)
      if (dateString === '2025-06-10') {
        // In a real implementation, this would be an API call
        // For now, simulate loading the Wednesday file content
        const wednesdayContent = `# Daily Preparation Checklist

## 1. Pastries Preparation

### Pastry Cart Setup
Items should be removed from freezer and arranged on the "Kaffeestückchen Wagen" cart. All items must be placed on trays with protective foil.

| Item | Quantity | Tray # |
|------|----------|--------|
| Schokocroissant | 8 | 1 |
| Croissant | 10 | 2 |
| Schoko-Vanille Hörnchen | 6 | 3 |
| Quarktaschen | 6 | 4 |
| Nusschnecke | 5 | 5 |
| Pudding Schnecke | 5 | 5 |
| Pudding Plunder | 6 | 6 |
| Kirschtaschen | 6 | 7 |
| Apfeltaschen | 6 | 7 |
| Franzbrötchen | 4 | 8 |
| Marzipanschleifen | 5 | 9 |
| Laugenstangen | 8 | 10 |
| Einback | 15 | 11-13 |
| Streusel | 6 | 14 |
| Nougatplunder | 36 | 15-17 |

**Final Step:** Push cart into retarder and set to program A.

## 2. Sourdough Preparation

### Buttermilchbrot (Weizensauerteig)

#### Ingredients:
- 28g starter culture
- 188g water
- 378g wheat flour

#### Instructions:
1. Mix ingredients quickly until a dough ball forms
2. Remove dough from bowl and knead slowly until smooth
3. Place in small, clean container
4. Store in small proofing cabinet (27°C for 599 minutes - extended fermentation)

## 3. Brühstück Preparation

### Vollgut Brot

#### Ingredients:
- 400g sunflower seeds
- 400g flaxseed
- 800ml boiling water

#### Instructions:
1. Place seeds in heat-resistant container
2. Pour boiling water over the seeds
3. Stir to ensure all seeds are fully soaked
4. Cover and let sit until used in the morning

## 4. Meatloaf Preparation

#### Instructions:
1. Grease GN container
2. Remove meatloaf in casing from freezer (located in tray on small scale)
3. Score skin, then remove casing
4. Place in container without lid
5. Place in small oven and set to 105°C`
        
        return MarkdownParser.parseMarkdownPrepFile(wednesdayContent)
      }
    } catch (error) {
      console.error('Error loading specific date file:', error)
    }
    
    return null
  }
}