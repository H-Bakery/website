export interface ProductOrder {
  [productName: string]: number
}

export interface Recipe {
  doughPieces: number
  doughPerPiece: number
  filling?: string
  fillingAmount?: number
}

interface StringNumberMap {
  [key: string]: number
}

interface RecipeCollection {
  [productName: string]: Recipe
}

export const formatFillingName = (filling: string): string => {
  switch (filling) {
    case 'nuss':
      return 'Nussfüllung'
    case 'schoko':
      return 'Schokofüllung'
    case 'pudding':
      return 'Puddingfüllung'
    case 'marzipan':
      return 'Marzipanfüllung'
    default:
      return filling
  }
}

export class HefezopfCalculator {
  // Recipes for each product
  recipes: RecipeCollection = {
    'Hefezopf Plain': {
      doughPieces: 1,
      doughPerPiece: 500,
    },
    'Hefekranz Nuss': {
      doughPieces: 1,
      doughPerPiece: 400,
      filling: 'nuss',
      fillingAmount: 250,
    },
    'Hefekranz Schoko': {
      doughPieces: 1,
      doughPerPiece: 400,
      filling: 'schoko',
      fillingAmount: 250,
    },
    'Hefekranz Pudding': {
      doughPieces: 1,
      doughPerPiece: 400,
      filling: 'pudding',
      fillingAmount: 300,
    },
    'Hefekranz Marzipan': {
      doughPieces: 1,
      doughPerPiece: 400,
      filling: 'marzipan',
      fillingAmount: 200,
    },
    'Mini Hefezopf': {
      doughPieces: 1,
      doughPerPiece: 250,
    },
    'Hefeschnecken Nuss': {
      doughPieces: 1,
      doughPerPiece: 80,
      filling: 'nuss',
      fillingAmount: 50,
    },
    'Hefeschnecken Schoko': {
      doughPieces: 1,
      doughPerPiece: 80,
      filling: 'schoko',
      fillingAmount: 50,
    },
  }

  // Standard batch sizes
  standardBatchSize = 5000 // grams of dough per batch
  standardFillingBatchSize = 2000 // grams of filling per batch

  calculateProductionNeeds(orders: ProductOrder) {
    // Initialize
    let totalDoughWeight = 0
    const doughPieces: StringNumberMap = {}

    // Define fillings with a type that includes both specific keys and string indexing
    const fillings: {
      nuss: number
      schoko: number
      pudding: number
      marzipan: number
      [key: string]: number // Allow other string keys
    } = {
      nuss: 0,
      schoko: 0,
      pudding: 0,
      marzipan: 0,
    }

    // Calculate total dough weight and filling needs
    Object.entries(orders).forEach(([product, quantity]) => {
      if (this.recipes[product]) {
        const recipe = this.recipes[product]
        const doughWeight = recipe.doughPerPiece * quantity
        totalDoughWeight += doughWeight

        // Track dough pieces by size
        const pieceSizeKey = `${recipe.doughPerPiece}g`
        doughPieces[pieceSizeKey] = (doughPieces[pieceSizeKey] || 0) + quantity

        // Calculate filling needs
        if (recipe.filling && recipe.fillingAmount) {
          fillings[recipe.filling] += recipe.fillingAmount * quantity
        }
      }
    })

    // Calculate number of dough batches needed
    const doughBatches = Math.ceil(totalDoughWeight / this.standardBatchSize)

    // Calculate filling batches
    const fillingBatches: StringNumberMap = {}
    Object.entries(fillings).forEach(([filling, weight]) => {
      fillingBatches[filling] = Math.ceil(
        weight / this.standardFillingBatchSize
      )
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
}
