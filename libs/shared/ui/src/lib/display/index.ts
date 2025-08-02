/**
 * Display Components Export
 *
 * Re-exports all display-related components for easy consumption
 */

// Export components
export { Hero } from './hero'
export { CallToAction } from './call-to-action'
export { MarkdownDisplay } from './markdown-display'

// Export types
export type { HeroProps } from './hero'
export type { CallToActionProps, CTAAction } from './call-to-action'
export type { MarkdownDisplayProps } from './markdown-display'

// Re-export defaults for backwards compatibility
export { Hero as DefaultHero } from './hero'
export { CallToAction as DefaultCallToAction } from './call-to-action'
export { MarkdownDisplay as DefaultMarkdownDisplay } from './markdown-display'
