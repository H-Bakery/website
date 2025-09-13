export interface PrepIngredient {
  name: string
  quantity: number
  unit: string
}

export interface PrepTaskItem {
  name: string
  quantity: number
  tray_number?: number
  tray_numbers?: number[]
  trays_of?: number
  completed: boolean
  stock_status?: 'sufficient' | 'low' | 'critical' | 'empty'
  current_stock?: number
  min_stock_level?: number
}

export interface PrepSection {
  name: string
  description?: string
  instructions?: string[]
  final_step?: string
  items?: PrepTaskItem[]
  ingredients?: PrepIngredient[]
  completed: boolean
  time_completed?: string
}

export interface BakingItem {
  name: string
  standard_quantity: number
  quantity: number
  unit?: string
  note?: string
}

export interface AdditionalProductionItem {
  name: string
  quantity: number
  reason: 'low_stock' | 'empty_stock' | 'special_request' | 'quality_issue'
  urgency: 'low' | 'medium' | 'high'
  category: 'bread' | 'pastry' | 'cake' | 'other'
  notes?: string
  requested_by?: string
  requested_at?: string
}
