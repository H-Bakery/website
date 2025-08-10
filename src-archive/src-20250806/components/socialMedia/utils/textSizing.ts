/**
 * Dynamic text sizing utility for the Simple Square template
 * Calculates optimal font size based on text length and content area
 */

export interface TextSizingOptions {
  maxWidth: number
  maxHeight: number
  baseFontSize?: number
  minFontSize?: number
  maxFontSize?: number
  lineHeightRatio?: number
}

export interface TextSizingResult {
  fontSize: number
  lineHeight: number
  estimatedLines: number
  fitsInArea: boolean
}

/**
 * Calculate optimal font size based on text length and available space
 */
export function calculateOptimalFontSize(
  text: string,
  options: TextSizingOptions
): TextSizingResult {
  const {
    maxWidth,
    maxHeight,
    baseFontSize = 72,
    minFontSize = 24,
    maxFontSize = 120,
    lineHeightRatio = 1.3,
  } = options

  // Clean and prepare text
  const cleanText = text.trim()
  if (!cleanText) {
    return {
      fontSize: baseFontSize,
      lineHeight: baseFontSize * lineHeightRatio,
      estimatedLines: 0,
      fitsInArea: true,
    }
  }

  const textLength = cleanText.length
  let fontSize = baseFontSize

  // Step 1: Initial size calculation based on text length
  if (textLength <= 15) {
    // Very short text - use maximum impact
    fontSize = Math.min(maxFontSize, baseFontSize + 48)
  } else if (textLength <= 30) {
    // Short text - large but readable
    fontSize = Math.min(maxFontSize, baseFontSize + 24)
  } else if (textLength <= 60) {
    // Medium text - base size
    fontSize = baseFontSize
  } else if (textLength <= 100) {
    // Long text - reduce size
    fontSize = Math.max(minFontSize, baseFontSize - 24)
  } else if (textLength <= 150) {
    // Very long text - further reduce
    fontSize = Math.max(minFontSize, baseFontSize - 36)
  } else {
    // Extremely long text - minimum size
    fontSize = Math.max(minFontSize, baseFontSize - 48)
  }

  // Step 2: Estimate if text fits in the available area
  const lineHeight = fontSize * lineHeightRatio
  const charactersPerLine = estimateCharactersPerLine(fontSize, maxWidth)
  const estimatedLines = Math.ceil(textLength / charactersPerLine)
  const totalTextHeight = estimatedLines * lineHeight

  // Step 3: Adjust if text doesn't fit vertically
  let adjustedFontSize = fontSize
  if (totalTextHeight > maxHeight) {
    // Calculate maximum font size that fits
    const maxLinesForHeight = Math.floor(maxHeight / lineHeight)
    const requiredCharactersPerLine = Math.ceil(textLength / maxLinesForHeight)

    // Estimate required font size reduction
    const reductionFactor = charactersPerLine / requiredCharactersPerLine
    adjustedFontSize = Math.max(minFontSize, fontSize * reductionFactor * 0.8)

    // Recalculate with adjusted size
    const adjustedLineHeight = adjustedFontSize * lineHeightRatio
    const adjustedCharactersPerLine = estimateCharactersPerLine(
      adjustedFontSize,
      maxWidth
    )
    const adjustedEstimatedLines = Math.ceil(
      textLength / adjustedCharactersPerLine
    )
    const adjustedTotalHeight = adjustedEstimatedLines * adjustedLineHeight

    return {
      fontSize: adjustedFontSize,
      lineHeight: adjustedLineHeight,
      estimatedLines: adjustedEstimatedLines,
      fitsInArea: adjustedTotalHeight <= maxHeight,
    }
  }

  return {
    fontSize: adjustedFontSize,
    lineHeight: lineHeight,
    estimatedLines: estimatedLines,
    fitsInArea: totalTextHeight <= maxHeight,
  }
}

/**
 * Estimate how many characters fit per line based on font size and width
 * This is an approximation - actual rendering may vary
 */
function estimateCharactersPerLine(fontSize: number, maxWidth: number): number {
  // Average character width is approximately 0.6 * fontSize for most fonts
  const avgCharacterWidth = fontSize * 0.6
  return Math.floor(maxWidth / avgCharacterWidth)
}

/**
 * Calculate responsive font size for Simple Square template specifically
 */
export function calculateSimpleSquareFontSize(text: string): TextSizingResult {
  // Simple Square template dimensions and constraints
  const templateWidth = 1080
  const templateHeight = 1080

  // Account for padding (10% on all sides)
  const availableWidth = templateWidth * 0.8 // 864px
  const availableHeight = templateHeight * 0.8 // 864px

  return calculateOptimalFontSize(text, {
    maxWidth: availableWidth,
    maxHeight: availableHeight,
    baseFontSize: 72,
    minFontSize: 28,
    maxFontSize: 140,
    lineHeightRatio: 1.2,
  })
}

/**
 * Get CSS styles for Simple Square text based on calculated sizing
 */
export function getSimpleSquareTextStyles(text: string): React.CSSProperties {
  const sizingResult = calculateSimpleSquareFontSize(text)

  return {
    fontSize: `${sizingResult.fontSize}px`,
    lineHeight: `${sizingResult.lineHeight}px`,
    textAlign: 'center' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    overflow: 'hidden',
  }
}
