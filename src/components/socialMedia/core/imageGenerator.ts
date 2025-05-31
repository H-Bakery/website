import {
  Template,
  TemplateType,
  SocialMediaContent,
} from '../../../types/socialMedia'

/**
 * Generate an image based on the template type and content
 */
export const generateTemplateImage = async (
  content: Partial<SocialMediaContent>,
  template: Template,
  templateType: TemplateType,
  width = 1080,
  height = 1080
): Promise<string> => {
  // Generate appropriate image based on template type
  switch (templateType) {
    case 'daily-special':
      return generateDailySpecialImage(content, template, width, height)
    case 'bread-of-day':
      return generateBreadOfDayImage(content, template, width, height)
    case 'offer':
      return generateOfferImage(content, template, width, height)
    case 'bakery-news':
      return generateNewsImage(content, template, width, height)
    default:
      return generateBasicImage(content, template, width, height)
  }
}

/**
 * Generate daily special image (lunch menu style)
 */
const generateDailySpecialImage = (
  content: Partial<SocialMediaContent>,
  template: Template,
  width: number,
  height: number
): string => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Background
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
  bgGradient.addColorStop(0, '#FFFFFF')
  bgGradient.addColorStop(1, '#F6F8FC')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Header with brand name
  ctx.font = 'bold 48px "Averia Serif Libre", serif'
  ctx.fillStyle = '#D038BA' // Primary brand color
  ctx.textAlign = 'left'
  ctx.fillText('Bäckerei Heusser', 60, 80)

  // Menu title area
  ctx.fillStyle = '#D038BA'
  ctx.fillRect(0, 180, width, 140)

  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 68px "Averia Serif Libre", serif'
  ctx.textAlign = 'center'
  ctx.fillText('TAGESANGEBOT', width / 2, 270)

  // Content panel
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Main content area
  const panelGradient = ctx.createLinearGradient(0, 340, 0, height)
  panelGradient.addColorStop(0, '#D038BA')
  panelGradient.addColorStop(1, '#C030AA')
  ctx.fillStyle = panelGradient
  ctx.fillRect(0, 340, width, height - 340)

  // Title
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.font = 'bold 60px "Averia Serif Libre", serif'

  wrapText(
    ctx,
    content.textElements?.title || 'Mittagstisch',
    80,
    440,
    width - 160,
    70
  )

  // Description
  ctx.font = '36px "Ubuntu", sans-serif'
  wrapText(
    ctx,
    content.textElements?.description || '',
    80,
    550,
    width - 160,
    45
  )

  // Price box
  if (content.textElements?.price) {
    // Price background
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    const priceText = content.textElements.price
    const priceMetrics = ctx.measureText(priceText)
    const priceBoxWidth = priceMetrics.width + 80

    ctx.fillRect(80, height - 180, priceBoxWidth, 80)

    // Price text
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 58px "Averia Serif Libre", serif'
    ctx.fillText(priceText, 120, height - 120)
  }

  // Additional info
  if (content.textElements?.callToAction) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = '28px "Ubuntu", sans-serif'
    ctx.fillText(content.textElements.callToAction, 80, height - 60)
  }

  // Add logo/wappen placeholder in bottom right
  drawLogoPlaceholder(ctx, width, height)

  return canvas.toDataURL('image/png')
}

/**
 * Generate bread of day image (product spotlight style)
 */
const generateBreadOfDayImage = (
  content: Partial<SocialMediaContent>,
  template: Template,
  width: number,
  height: number
): string => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Background pattern
  ctx.fillStyle = '#FBF7F2' // Light beige/cream color for bread
  ctx.fillRect(0, 0, width, height)

  // Draw subtle pattern
  ctx.fillStyle = 'rgba(228, 217, 202, 0.3)'
  for (let i = 0; i < width; i += 20) {
    for (let j = 0; j < height; j += 20) {
      if ((i + j) % 40 === 0) {
        ctx.fillRect(i, j, 10, 10)
      }
    }
  }

  // Header with brand name
  ctx.font = 'bold 48px "Averia Serif Libre", serif'
  ctx.fillStyle = '#D038BA' // Primary brand color
  ctx.textAlign = 'left'
  ctx.fillText('Bäckerei Heusser', 60, 80)

  // Badge for "Bread of the day"
  ctx.beginPath()
  ctx.arc(width - 160, 140, 100, 0, Math.PI * 2)
  ctx.fillStyle = '#D038BA'
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 28px "Averia Serif Libre", serif'
  ctx.textAlign = 'center'
  ctx.fillText('BROT', width - 160, 125)
  ctx.fillText('DES', width - 160, 155)
  ctx.fillText('TAGES', width - 160, 185)

  // Main content area
  ctx.fillStyle = '#D038BA'
  ctx.fillRect(0, height / 2 - 70, width, height / 2 + 70)

  // Special label if available
  if (content.textElements?.specialLabel) {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 32px "Ubuntu", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(content.textElements.specialLabel, 80, height / 2 - 20)

    // Decorative underline
    ctx.beginPath()
    ctx.moveTo(80, height / 2)
    ctx.lineTo(
      80 + ctx.measureText(content.textElements.specialLabel).width,
      height / 2
    )
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Bread name (title)
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.font = 'bold 62px "Averia Serif Libre", serif'
  wrapText(
    ctx,
    content.textElements?.breadName ||
      content.textElements?.title ||
      'Brot des Tages',
    80,
    height / 2 + 70,
    width - 160,
    70
  )

  // Description
  ctx.font = '34px "Ubuntu", sans-serif'
  wrapText(
    ctx,
    content.textElements?.breadDescription ||
      content.textElements?.description ||
      '',
    80,
    height / 2 + 150,
    width - 160,
    45
  )

  // Price
  if (content.textElements?.price) {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 46px "Averia Serif Libre", serif'
    ctx.fillText(content.textElements.price, 80, height - 80)
  }

  // Ingredients if available
  if (content.textElements?.ingredients) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = 'italic 24px "Ubuntu", sans-serif'
    ctx.fillText(
      'Zutaten: ' + content.textElements.ingredients,
      80,
      height - 40
    )
  }

  // Add logo/wappen placeholder in bottom right
  drawLogoPlaceholder(ctx, width, height)

  return canvas.toDataURL('image/png')
}

/**
 * Generate offer image (promotional style)
 */
const generateOfferImage = (
  content: Partial<SocialMediaContent>,
  template: Template,
  width: number,
  height: number
): string => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Bold background
  ctx.fillStyle = '#D038BA'
  ctx.fillRect(0, 0, width, height)

  // Add some pattern/texture
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let i = 0; i < width; i += 40) {
    ctx.fillRect(i, 0, 20, height)
  }

  // Header with brand name
  ctx.font = 'bold 48px "Averia Serif Libre", serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.fillText('Bäckerei Heusser', 60, 80)

  // Season banner if available
  if (content.textElements?.season) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(60, 150, 300, 60)

    ctx.fillStyle = '#D038BA'
    ctx.font = 'bold 32px "Ubuntu", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(content.textElements.season, 210, 190)
  }

  // Main content white box
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(60, 250, width - 120, height - 360)

  // Title
  ctx.fillStyle = '#D038BA'
  ctx.textAlign = 'center'
  ctx.font = 'bold 56px "Averia Serif Libre", serif'

  wrapText(
    ctx,
    content.textElements?.title || 'Sonderangebot',
    width / 2,
    330,
    width - 220,
    70
  )

  // Subtitle if available
  if (content.textElements?.subtitle) {
    ctx.fillStyle = '#777777'
    ctx.font = 'italic 32px "Ubuntu", sans-serif'
    ctx.fillText(content.textElements.subtitle, width / 2, 400)

    // Description (starts lower if subtitle exists)
    ctx.font = '32px "Ubuntu", sans-serif'
    ctx.fillStyle = '#333333'
    wrapText(
      ctx,
      content.textElements?.description || '',
      width / 2,
      470,
      width - 220,
      40
    )
  } else {
    // Description (starts higher if no subtitle)
    ctx.font = '32px "Ubuntu", sans-serif'
    ctx.fillStyle = '#333333'
    wrapText(
      ctx,
      content.textElements?.description || '',
      width / 2,
      430,
      width - 220,
      40
    )
  }

  // Price info
  if (content.textElements?.priceInfo || content.textElements?.price) {
    const priceText =
      content.textElements?.priceInfo || content.textElements?.price

    // Price bubble
    ctx.beginPath()
    ctx.arc(width / 2, height - 170, 80, 0, Math.PI * 2)
    ctx.fillStyle = '#D038BA'
    ctx.fill()

    // Price text
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 36px "Averia Serif Libre", serif'
    ctx.fillText(priceText, width / 2, height - 160)
  }

  // Call to action
  if (content.textElements?.callToAction) {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 40px "Averia Serif Libre", serif'
    ctx.fillText(content.textElements.callToAction, width / 2, height - 60)
  } else {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 40px "Averia Serif Libre", serif'
    ctx.fillText('Jetzt zugreifen!', width / 2, height - 60)
  }

  // Add logo placeholder
  drawLogoPlaceholder(ctx, width, height)

  return canvas.toDataURL('image/png')
}

/**
 * Generate news image (information style)
 */
const generateNewsImage = (
  content: Partial<SocialMediaContent>,
  template: Template,
  width: number,
  height: number
): string => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Subtle background
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
  bgGradient.addColorStop(0, '#F6F8FC')
  bgGradient.addColorStop(1, '#EBF0F9')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Header with brand name
  ctx.font = 'bold 48px "Averia Serif Libre", serif'
  ctx.fillStyle = '#D038BA'
  ctx.textAlign = 'left'
  ctx.fillText('Bäckerei Heusser', 60, 80)

  // Category label
  if (content.textElements?.category) {
    ctx.fillStyle = '#D038BA'
    ctx.fillRect(60, 130, 300, 50)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 26px "Ubuntu", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(content.textElements.category, 210, 165)
  }

  // News content area
  ctx.fillStyle = '#FFFFFF'
  ctx.shadowColor = 'rgba(0,0,0,0.1)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 5
  ctx.fillRect(60, 210, width - 120, height - 310)
  ctx.shadowBlur = 0

  // Title
  ctx.fillStyle = '#D038BA'
  ctx.textAlign = 'left'
  ctx.font = 'bold 58px "Averia Serif Libre", serif'

  wrapText(
    ctx,
    content.textElements?.newsTitle ||
      content.textElements?.title ||
      'Wichtige Information',
    100,
    290,
    width - 200,
    70
  )

  // News content
  ctx.fillStyle = '#333333'
  ctx.font = '30px "Ubuntu", sans-serif'
  wrapText(
    ctx,
    content.textElements?.newsContent ||
      content.textElements?.description ||
      '',
    100,
    400,
    width - 200,
    40
  )

  // Date if available
  if (content.textElements?.date) {
    ctx.fillStyle = '#777777'
    ctx.font = 'italic 28px "Ubuntu", sans-serif'
    ctx.fillText(content.textElements.date, 100, height - 140)
  }

  // Contact if available
  if (content.textElements?.contact) {
    ctx.fillStyle = '#555555'
    ctx.font = '24px "Ubuntu", sans-serif'
    ctx.fillText(content.textElements.contact, 100, height - 100)
  }

  // Bottom area
  ctx.fillStyle = '#D038BA'
  ctx.fillRect(0, height - 60, width, 60)

  // Add logo placeholder
  drawLogoPlaceholder(ctx, width, height)

  return canvas.toDataURL('image/png')
}

/**
 * Generate a basic image for any template type
 */
const generateBasicImage = (
  content: Partial<SocialMediaContent>,
  template: Template,
  width: number,
  height: number
): string => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Draw background
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
  bgGradient.addColorStop(0, '#FFFFFF')
  bgGradient.addColorStop(1, '#F6F8FC')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Draw text panel background
  const panelGradient = ctx.createLinearGradient(0, height * 0.33, 0, height)
  panelGradient.addColorStop(0, '#D038BA')
  panelGradient.addColorStop(1, '#C030AA')
  ctx.fillStyle = panelGradient
  ctx.fillRect(0, height * 0.33, width, height * 0.67)

  // Header with brand name
  ctx.font = 'bold 48px "Averia Serif Libre", serif'
  ctx.fillStyle = '#D038BA' // Primary brand color
  ctx.textAlign = 'left'
  ctx.fillText('Bäckerei Heusser', 60, 80)

  // Draw title - find the title from different possible fields
  const title =
    content.textElements?.title ||
    content.textElements?.breadName ||
    content.textElements?.newsTitle ||
    'Bäckerei Heusser'

  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.font = 'bold 60px "Averia Serif Libre", serif'
  wrapText(ctx, title, 80, height * 0.45, width * 0.85, 70)

  // Draw description from different possible fields
  const description =
    content.textElements?.description ||
    content.textElements?.breadDescription ||
    content.textElements?.newsContent ||
    ''

  ctx.font = '32px "Ubuntu", sans-serif'
  ctx.fillStyle = '#FFFFFF'
  wrapText(ctx, description, 80, height * 0.58, width * 0.85, 40)

  // Draw price/call to action
  const price =
    content.textElements?.price || content.textElements?.priceInfo || ''

  if (price) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(60, height * 0.77, 220, 70)

    ctx.font = 'bold 58px "Averia Serif Libre", serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(price, 80, height * 0.83)
  }

  // Add logo placeholder
  drawLogoPlaceholder(ctx, width, height)

  // Return image data
  return canvas.toDataURL('image/png')
}

/**
 * Draw a simple placeholder for the logo in the bottom right
 */
const drawLogoPlaceholder = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  ctx.save()
  // Add circular background
  ctx.beginPath()
  ctx.arc(width - 80, height - 80, 60, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.fill()

  // Add simple "H" text as logo placeholder
  // TODO: Replace with actual "wappen"
  ctx.font = 'bold 70px "Averia Serif Libre", serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText('H', width - 80, height - 55)
  ctx.restore()
}

/**
 * Helper function to wrap text
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const isTextCentered = ctx.textAlign === 'center'
  const words = text.split(' ')
  let line = ''
  let testLine = ''
  let lineCount = 0
  let currentY = y

  ctx.save()

  // Add shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 1
  ctx.shadowOffsetY = 1

  for (let n = 0; n < words.length; n++) {
    testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && n > 0) {
      const xPos = isTextCentered ? x : x
      ctx.fillText(line, xPos, currentY)
      line = words[n] + ' '
      currentY += lineHeight
      lineCount++

      if (lineCount > 4) {
        const xPos = isTextCentered ? x : x
        ctx.fillText(line + '...', xPos, currentY)
        break
      }
    } else {
      line = testLine
    }
  }

  const xPos = isTextCentered ? x : x
  ctx.fillText(line, xPos, currentY)

  ctx.restore()

  return currentY + lineHeight // Return the final y position
}
