// Types for daily preparation tasks

export interface PrepTaskItem {
  name: string
  quantity: number
  unit?: string
  tray_number?: number
  tray_numbers?: number[]
  trays_of?: number
  completed?: boolean
  stock_status?: 'sufficient' | 'low' | 'critical' | 'empty'
  current_stock?: number
  min_stock_level?: number
  needs_production?: boolean
  production_notes?: string
}

export interface PrepIngredient {
  name: string
  quantity: number
  unit: string
}

export interface PrepSection {
  name: string
  description: string
  instructions?: string[]
  items?: PrepTaskItem[]
  ingredients?: PrepIngredient[]
  final_step?: string
  completed?: boolean
  time_started?: string
  time_completed?: string
  estimated_duration?: number // in minutes
}

export interface BakingItem {
  name: string
  standard_quantity: number
  unit?: string
  note?: string
  quantity?: number
  priority?: 'normal' | 'high' | 'urgent'
  is_additional?: boolean
  reason?: string
}

export interface AdditionalProductionItem {
  name: string
  quantity: number
  unit?: string
  reason:
    | 'low_stock'
    | 'empty_stock'
    | 'special_order'
    | 'weekend_prep'
    | 'other'
  urgency: 'low' | 'medium' | 'high' | 'critical'
  notes?: string
  requested_by?: string
  requested_at?: string
  category: 'pastry' | 'bread' | 'cake' | 'filling' | 'dough'
}

export interface BakingSchedule {
  cakes: BakingItem[]
  bread: BakingItem[]
  additional_production?: AdditionalProductionItem[]
}

export interface PrepTaskConfig {
  preparation: {
    standard_time: string
    baking_start_time: string
    bakery_opening_time: string
  }
  pastry_cart: {
    description: string
    instructions: string
    final_step: string
    items: PrepTaskItem[]
  }
  sourdough: {
    description: string
    ingredients: PrepIngredient[]
    instructions: string[]
  }
  meatloaf: {
    description: string
    instructions: string[]
  }
  standard_baking: BakingSchedule
}

export interface PrepTaskHistory {
  date: string
  completed: boolean
  completionRate: number
  completedBy?: string
  completedAt?: string
  sections?: PrepSection[]
}

export interface PrepTaskSummary {
  totalTasks: number
  completedTasks: number
  completionRate: number
  estimatedTimeRemaining: number
  isOnSchedule: boolean
  nextTask?: string
}
