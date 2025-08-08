export interface NotificationTemplate {
  id?: number
  key: string
  name: string
  category:
    | 'production'
    | 'inventory'
    | 'order'
    | 'staff'
    | 'financial'
    | 'system'
    | 'customer'
  defaultTitle: {
    de: string
    en: string
  }
  defaultMessage: {
    de: string
    en: string
  }
  variables: string[]
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent'
  defaultType: 'info' | 'success' | 'warning' | 'error'
  isActive: boolean
  metadata?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

export interface TemplatePreview {
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  metadata: Record<string, any>
}

export interface TemplateValidation {
  valid: boolean
  usedVars: string[]
  undeclaredVars: string[]
  unusedVars: string[]
}

export interface TemplateResponse {
  success: boolean
  template?: NotificationTemplate
  templates?: NotificationTemplate[]
  preview?: TemplatePreview
  validation?: {
    title: TemplateValidation
    message: TemplateValidation
  }
  count?: number
  message?: string
  error?: string
}
