/**
 * Navigation utilities
 */
import React from 'react'

/**
 * Check if a path is active based on current pathname
 */
export function isPathActive(currentPath: string, targetPath: string): boolean {
  // Exact match
  if (currentPath === targetPath) return true

  // Check if current path starts with target path
  // This handles nested routes
  if (targetPath !== '/' && currentPath.startsWith(targetPath)) {
    // Make sure it's a proper segment match
    const nextChar = currentPath[targetPath.length]
    return !nextChar || nextChar === '/' || nextChar === '?'
  }

  return false
}

/**
 * Navigation item interface
 */
export interface NavigationItem {
  label: string
  href: string
  external?: boolean
  icon?: React.ReactNode
}

/**
 * Breadcrumb item interface
 */
export interface Breadcrumb {
  label: string
  href: string
  current?: boolean
}

export interface BreadcrumbItem {
  label: string
  href: string
}

/**
 * Get navigation items for specific app
 */
export function getNavigationForApp(
  app: 'landing' | 'shop' | 'management'
): NavigationItem[] {
  const navigationMap = {
    landing: [
      { label: 'Home', href: '/', external: false },
      { label: 'About', href: '/about', external: false },
      { label: 'Contact', href: '/contact', external: false },
    ],
    shop: [
      { label: 'Products', href: '/products', external: false },
      { label: 'Cart', href: '/cart', external: false },
      { label: 'Account', href: '/account', external: false },
    ],
    management: [
      { label: 'Orders', href: '/admin/orders', external: false },
      { label: 'Inventory', href: '/admin/inventory', external: false },
      { label: 'Production', href: '/admin/production', external: false },
    ],
  }

  return navigationMap[app] || []
}

/**
 * Generate breadcrumbs for app-specific navigation
 */
export function generateBreadcrumbs(
  pathname: string,
  app: 'landing' | 'shop' | 'management'
): Breadcrumb[] {
  // Mock breadcrumb generation based on pathname and app
  const breadcrumbMap: Record<string, Breadcrumb[]> = {
    // Landing app
    '/': [{ label: 'Home', href: '/', current: true }],
    '/about': [
      { label: 'Home', href: '/', current: false },
      { label: 'About', href: '/about', current: true },
    ],
    '/contact': [
      { label: 'Home', href: '/', current: false },
      { label: 'Contact', href: '/contact', current: true },
    ],

    // Shop app
    '/products': [
      { label: 'Home', href: '/', current: false },
      { label: 'Products', href: '/products', current: true },
    ],
    '/products/bread': [
      { label: 'Home', href: '/', current: false },
      { label: 'Products', href: '/products', current: false },
      { label: 'Bread', href: '/products/bread', current: true },
    ],
    '/cart': [
      { label: 'Home', href: '/', current: false },
      { label: 'Cart', href: '/cart', current: true },
    ],

    // Management app
    '/admin': [{ label: 'Dashboard', href: '/admin', current: true }],
    '/admin/orders': [
      { label: 'Dashboard', href: '/admin', current: false },
      { label: 'Orders', href: '/admin/orders', current: true },
    ],
    '/admin/orders/123': [
      { label: 'Dashboard', href: '/admin', current: false },
      { label: 'Orders', href: '/admin/orders', current: false },
      { label: 'Order #123', href: '/admin/orders/123', current: true },
    ],
    '/admin/inventory/products': [
      { label: 'Dashboard', href: '/admin', current: false },
      { label: 'Inventory', href: '/admin/inventory', current: false },
      { label: 'Products', href: '/admin/inventory/products', current: true },
    ],
  }

  return breadcrumbMap[pathname] || []
}

/**
 * Generate breadcrumb items from pathname (legacy version)
 */
export function generateBreadcrumbsLegacy(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }]

  let currentPath = ''

  segments.forEach((segment) => {
    currentPath += `/${segment}`

    // Convert segment to readable label
    const label = segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    breadcrumbs.push({
      label,
      href: currentPath,
    })
  })

  return breadcrumbs
}

/**
 * Sanitize URL parameters
 */
export function sanitizeUrlParam(param: string): string {
  return encodeURIComponent(param.trim())
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {}
  const searchParams = new URLSearchParams(queryString)

  searchParams.forEach((value, key) => {
    params[key] = value
  })

  return params
}

/**
 * Get the base path without query parameters
 */
export function getBasePath(pathname: string): string {
  return pathname.split('?')[0]
}

/**
 * Check if URL is external
 */
export function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.origin !== window.location.origin
  } catch {
    // If URL constructor fails, it's likely a relative URL
    return false
  }
}

/**
 * Normalize path (remove trailing slashes, etc.)
 */
export function normalizePath(path: string): string {
  // Remove trailing slash unless it's the root path
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path
  }

  return path
}
