import { Template, TemplateType } from '../../../types/socialMedia'

interface ContentData {
  title: string
  description: string
  price?: string
  additionalInfo?: string
}

/**
 * Maps generic content data to template-specific field structure
 */
export const mapContentToTemplate = (
  content: ContentData,
  template: Template,
  templateType: TemplateType
): Record<string, string> => {
  const mapped: Record<string, string> = {}

  switch (templateType) {
    case 'message':
      if (template.textElements.some((el) => el.id === 'message'))
        mapped.message = content.title || ''
      break

    case 'daily-special':
      const dailySpecialFields = template.textElements.map((el) => el.id)
      if (dailySpecialFields.includes('title'))
        mapped.title = content.title || 'Tagesangebot'
      if (dailySpecialFields.includes('description'))
        mapped.description = content.description
      if (dailySpecialFields.includes('price'))
        mapped.price = content.price ? `${content.price} €` : ''
      if (dailySpecialFields.includes('callToAction'))
        mapped.callToAction = content.additionalInfo || ''
      if (dailySpecialFields.includes('subtitle'))
        mapped.subtitle = 'Unser Angebot heute'
      break

    case 'bread-of-day':
      if (template.textElements.some((el) => el.id === 'breadName'))
        mapped.breadName = content.title || 'Brot des Tages'
      if (template.textElements.some((el) => el.id === 'breadDescription'))
        mapped.breadDescription = content.description
      if (template.textElements.some((el) => el.id === 'price'))
        mapped.price = content.price ? `${content.price} €` : ''
      if (template.textElements.some((el) => el.id === 'ingredients'))
        mapped.ingredients = content.additionalInfo || ''
      break

    case 'offer':
      if (template.textElements.some((el) => el.id === 'title'))
        mapped.title = content.title || 'Sonderangebot'
      if (template.textElements.some((el) => el.id === 'description'))
        mapped.description = content.description
      if (template.textElements.some((el) => el.id === 'priceInfo'))
        mapped.priceInfo = content.price ? `${content.price} €` : ''
      if (template.textElements.some((el) => el.id === 'callToAction'))
        mapped.callToAction = 'Jetzt zugreifen!'
      if (template.textElements.some((el) => el.id === 'subtitle'))
        mapped.subtitle = content.additionalInfo || ''
      break

    case 'bakery-news':
      if (template.textElements.some((el) => el.id === 'newsTitle'))
        mapped.newsTitle = content.title || 'Neuigkeiten'
      if (template.textElements.some((el) => el.id === 'newsContent'))
        mapped.newsContent = content.description
      if (template.textElements.some((el) => el.id === 'date'))
        mapped.date = content.additionalInfo || ''
      if (template.textElements.some((el) => el.id === 'category'))
        mapped.category = 'INFORMATION'
      break

    case 'facebook-post':
    case 'instagram-square':
    case 'instagram-story':
      if (template.textElements.some((el) => el.id === 'title'))
        mapped.title = content.title || `${templateType.split('-')[0]} Post`
      if (template.textElements.some((el) => el.id === 'description'))
        mapped.description = content.description
      if (template.textElements.some((el) => el.id === 'price'))
        mapped.price = content.price ? `${content.price} €` : ''
      if (template.textElements.some((el) => el.id === 'hashtags'))
        mapped.hashtags = content.additionalInfo || ''
      break

    case 'website-banner':
    case 'website-card':
      if (template.textElements.some((el) => el.id === 'title'))
        mapped.title = content.title || 'Website Titel'
      if (template.textElements.some((el) => el.id === 'description'))
        mapped.description = content.description
      if (template.textElements.some((el) => el.id === 'callToAction'))
        mapped.callToAction = content.additionalInfo || ''
      break

    case 'simple-square':
      // Simple Square only uses title with dynamic text sizing
      if (template.textElements.some((el) => el.id === 'title'))
        mapped.title = content.title || 'Ihre Nachricht hier...'
      // Note: Description and other fields are intentionally not mapped
      // as Simple Square is designed for single, impactful text
      break

    default:
      // Fallback for unknown template types
      mapped.title = content.title
      mapped.description = content.description
      if (content.price) mapped.price = `${content.price} €`
      if (content.additionalInfo) mapped.additionalInfo = content.additionalInfo
  }

  return mapped
}

/**
 * Gets the correct template for a given template type
 */
export const getTemplateForType = (
  templateType: TemplateType,
  templates: Template[],
  messageVariant?: 'primary' | 'white'
): Template => {
  if (templateType === 'message') {
    const targetId = messageVariant === 'white' ? 'simple-message-white' : 'simple-message'
    return templates.find(t => t.type === templateType && t.id === targetId) ||
           templates.find(t => t.type === templateType) ||
           templates[0]
  }
  
  return templates.find(t => t.type === templateType) || templates[0]
}