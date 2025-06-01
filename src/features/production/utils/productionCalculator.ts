import { DOUGH_PIECES, DoughPiece } from '../data/doughPieces'
import { FILLINGS, formatFillingName, getFillingById } from '../data/fillings'

export interface ProductOrder {
  [productName: string]: number
}

export interface Recipe {
  name: string
  doughPiece: string // reference to the dough piece type
  pieces: number // how many dough pieces are needed
  filling?: string // reference to filling type
  fillingAmount?: number // grams of filling per product
}

interface StringNumberMap {
  [key: string]: number
}

interface RecipeCollection {
  [productName: string]: Recipe
}

export interface ProductionPlan {
  totalDoughWeight: number
  doughPieces: { [key: string]: number } // Map of dough piece name to count
  doughBatches: number
  fillings: { [key: string]: number } // Map of filling ID to total grams
  fillingBatches: { [key: string]: number } // Map of filling ID to batch count
  calculator?: HefezopfCalculator // Reference to calculator for recipe access
}

export class HefezopfCalculator {
  // Recipes for each product
  recipes: RecipeCollection = {
    'Hefezopf Plain': {
      name: 'Hefezopf Plain',
      doughPiece: 'Großer Zopf',
      pieces: 1,
      // No filling for plain zopf
    },
    'Hefekranz Nuss': {
      name: 'Hefekranz Nuss',
      doughPiece: 'Gefüllter Kranz',
      pieces: 1,
      filling: 'nuss',
      fillingAmount: 1200,
    },
    'Hefekranz Schoko': {
      name: 'Hefekranz Schoko',
      doughPiece: 'Gefüllter Kranz',
      pieces: 1,
      filling: 'schoko',
      fillingAmount: 1200,
    },
    'Hefekranz Pudding': {
      name: 'Hefekranz Pudding',
      doughPiece: 'Gefüllter Kranz',
      pieces: 1,
      filling: 'pudding',
      fillingAmount: 1200,
    },
    'Hefekranz Marzipan': {
      name: 'Hefekranz Marzipan',
      doughPiece: 'Gefüllter Kranz',
      pieces: 1,
      filling: 'marzipan',
      fillingAmount: 1200,
    },
    'Hefekranz Quark': {
      name: 'Hefekranz Quark',
      doughPiece: 'Gefüllter Kranz',
      pieces: 1,
      filling: 'quark',
      fillingAmount: 1200,
    },
    'Mini Hefezopf': {
      name: 'Mini Hefezopf',
      doughPiece: 'Kleiner Zopf',
      pieces: 1,
    },
    'Gefüllter Zopf Nuss': {
      name: 'Gefüllter Zopf Nuss',
      doughPiece: 'Gefüllter Zopf',
      pieces: 1,
      filling: 'nuss',
      fillingAmount: 450,
    },
    'Gefüllter Zopf Schoko': {
      name: 'Gefüllter Zopf Schoko',
      doughPiece: 'Gefüllter Zopf',
      pieces: 1,
      filling: 'schoko',
      fillingAmount: 450,
    },
    'Gefüllter Zopf Marzipan': {
      name: 'Gefüllter Zopf Marzipan',
      doughPiece: 'Gefüllter Zopf',
      pieces: 1,
      filling: 'marzipan',
      fillingAmount: 450,
    },
    Rosinenbrot: {
      name: 'Rosinenbrot',
      doughPiece: 'Rosinenbrot',
      pieces: 1,
    },
    'Streuselkuchen Klein': {
      name: 'Streuselkuchen Klein',
      doughPiece: 'Kleiner Streusel',
      pieces: 1,
    },
    'Streuselkuchen Groß': {
      name: 'Streuselkuchen Groß',
      doughPiece: 'Großer Streusel',
      pieces: 1,
    },
  }

  // Standard batch sizes
  standardBatchSize = 40000 // grams of dough per batch (40kg)

  calculateProductionNeeds(orders: ProductOrder): ProductionPlan {
    // Initialize
    let totalDoughWeight = 0
    const doughPieces: StringNumberMap = {}
    const doughPieceMap = new Map<string, DoughPiece>()

    // Build a map for quick lookup
    DOUGH_PIECES.forEach((piece) => {
      doughPieceMap.set(piece.name, piece)
    })

    // Define fillings with both specific keys and string indexing
    const fillings: { [key: string]: number } = {}
    FILLINGS.forEach((filling) => {
      fillings[filling.id] = 0
    })

    // Calculate total dough weight and filling needs
    Object.entries(orders).forEach(([product, quantity]) => {
      if (this.recipes[product]) {
        const recipe = this.recipes[product]
        const doughPiece = doughPieceMap.get(recipe.doughPiece)

        if (doughPiece) {
          // Calculate dough weight based on the dough piece definition
          // Ein Produkt besteht aus mehreren Teigstücken (count) mit gleichem Gewicht (weight)
          const doughWeight = doughPiece.weight * doughPiece.count * quantity
          totalDoughWeight += doughWeight

          // Track dough pieces by type - jetzt mit der korrekten Anzahl der Teigstücke pro Produkt
          // Jedes Produkt (z.B. ein Kranz) besteht aus mehreren Teigstücken (z.B. 3x 600g)
          doughPieces[recipe.doughPiece] =
            (doughPieces[recipe.doughPiece] || 0) + quantity * doughPiece.count

          // Calculate filling needs
          if (recipe.filling && recipe.fillingAmount) {
            fillings[recipe.filling] =
              (fillings[recipe.filling] || 0) + recipe.fillingAmount * quantity
          }
        }
      }
    })

    // Calculate number of dough batches needed
    const doughBatches = Math.ceil(totalDoughWeight / this.standardBatchSize)

    // Calculate filling batches (15kg per batch)
    const standardFillingBatchSize = 15000 // 15kg per batch
    const fillingBatches: StringNumberMap = {}
    Object.entries(fillings).forEach(([fillingId, weight]) => {
      if (weight > 0) {
        fillingBatches[fillingId] = Math.ceil(weight / standardFillingBatchSize)
      }
    })

    return {
      totalDoughWeight,
      doughPieces,
      doughBatches,
      fillings,
      fillingBatches,
      calculator: this, // Include calculator for recipe access
    }
  }

  getDoughPieceDetails(doughPieceName: string): DoughPiece | undefined {
    return DOUGH_PIECES.find((piece) => piece.name === doughPieceName)
  }

  getProductsWithFilling(fillingId: string): string[] {
    return Object.entries(this.recipes)
      .filter(([_, recipe]) => recipe.filling === fillingId)
      .map(([productName, _]) => productName)
  }
}

export { formatFillingName }
