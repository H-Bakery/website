export interface Filling {
  name: string
  id: string
  ingredients: Ingredient[]
  recipeBatchSize: number // in grams - size of one recipe batch
}

export interface Ingredient {
  name: string
  amount: number
  unit: 'g' | 'ml' | 'stk'
}

/**
 * Data derived from "Füllungen für Kränze" documentation
 * Defines the standard filling recipes used in bakery production
 */
export const FILLINGS: Filling[] = [
  {
    name: 'Nussfüllung',
    id: 'nuss',
    recipeBatchSize: 1600, // 1000g nüsse + 600ml wasser
    ingredients: [
      {
        name: 'Nüsse (gemahlen)',
        amount: 1000,
        unit: 'g',
      },
      {
        name: 'Wasser',
        amount: 600,
        unit: 'ml',
      },
    ],
  },
  {
    name: 'Marzipanfüllung',
    id: 'marzipan',
    recipeBatchSize: 1500, // 1000g marzipan + 500ml wasser
    ingredients: [
      {
        name: 'Marzipanrohmasse',
        amount: 1000,
        unit: 'g',
      },
      {
        name: 'Wasser',
        amount: 500,
        unit: 'ml',
      },
    ],
  },
  {
    name: 'Schokoladenfüllung',
    id: 'schoko',
    recipeBatchSize: 2800, // 800g kakao + 800g zucker + 1200ml wasser
    ingredients: [
      {
        name: 'Kakao',
        amount: 800,
        unit: 'g',
      },
      {
        name: 'Zucker',
        amount: 800,
        unit: 'g',
      },
      {
        name: 'Wasser',
        amount: 1200,
        unit: 'ml',
      },
    ],
  },
  {
    name: 'Puddingfüllung',
    id: 'pudding',
    recipeBatchSize: 1350, // 350g puddingmasse + 1000ml wasser
    ingredients: [
      {
        name: 'Puddingmasse',
        amount: 350,
        unit: 'g',
      },
      {
        name: 'Wasser',
        amount: 1000,
        unit: 'ml',
      },
    ],
  },
  {
    name: 'Quarkfüllung',
    id: 'quark',
    recipeBatchSize: 600, // 250g quark + 100g zucker + 100g quarkfix + 150g sahne
    ingredients: [
      {
        name: 'Quark',
        amount: 250,
        unit: 'g',
      },
      {
        name: 'Zucker',
        amount: 100,
        unit: 'g',
      },
      {
        name: 'Quarkfix',
        amount: 100,
        unit: 'g',
      },
      {
        name: 'Sahne',
        amount: 150,
        unit: 'g',
      },
    ],
  },
]

export const getFillingById = (id: string): Filling | undefined => {
  return FILLINGS.find((filling) => filling.id === id)
}

export const formatFillingName = (fillingId: string): string => {
  const filling = getFillingById(fillingId)
  return filling ? filling.name : fillingId
}
