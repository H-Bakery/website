export type TemplateType = 
  | 'daily-special' 
  | 'offer' 
  | 'bread-of-day' 
  | 'bakery-news'

export interface TextElement {
  id: string
  text: string
  maxLength?: number
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  placeholder: string
  required: boolean
  highlight?: boolean
}

export interface ImageElement {
  id: string
  src?: string
  alt?: string
  required: boolean
  aspectRatio?: string
  isBackground?: boolean
}

export interface ColorScheme {
  primary: string
  secondary: string
  background: string
  text: string
  accent: string
}

export interface TextPanelStyle {
  background: string
  textColor: string
}

export interface Template {
  id: string
  name: string
  type: TemplateType
  description: string
  width: number
  height: number
  textElements: TextElement[]
  imageElements: ImageElement[]
  backgroundImage?: string
  colors: ColorScheme
  backgroundStyle?: string
  textPanelStyle?: TextPanelStyle
  overlayStyle?: string
}

export interface SocialMediaContent {
  id: string
  name: string
  templateId: string
  createdAt: string
  updatedAt: string
  textElements: Record<string, string>
  imageElements: Record<string, string>
}
