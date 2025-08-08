/**
 * Image optimization utilities for static export
 */

/**
 * Generate blur placeholder data URL
 * Since we're using static export, we need to handle this client-side
 */
export function getBlurDataURL(width = 10, height = 10): string {
  const canvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) {
    // Return a minimal transparent data URL for SSR
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  }

  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Create a simple gradient placeholder
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#f0f0f0')
  gradient.addColorStop(1, '#e0e0e0')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  return canvas.toDataURL()
}

/**
 * Optimize image loading with intersection observer
 */
export function lazyLoadImages(): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return
  }

  const images = document.querySelectorAll<HTMLImageElement>('img[data-lazy]')

  const imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          const src = img.getAttribute('data-lazy')
          if (src) {
            img.src = src
            img.removeAttribute('data-lazy')
            observer.unobserve(img)
          }
        }
      })
    },
    {
      rootMargin: '50px 0px',
      threshold: 0.01,
    }
  )

  images.forEach((img) => imageObserver.observe(img))
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = src
  })
}

/**
 * Get optimized image props for Next.js Image component
 */
export interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  loading?: 'lazy' | 'eager'
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  quality?: number
  sizes?: string
}

export function getOptimizedImageProps(
  src: string,
  alt: string,
  options: Partial<OptimizedImageProps> = {}
): OptimizedImageProps {
  const {
    width = 800,
    height = 600,
    priority = false,
    loading = priority ? 'eager' : 'lazy',
    placeholder = 'blur',
    blurDataURL = getBlurDataURL(),
    quality = 75,
    sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  } = options

  return {
    src,
    alt,
    width,
    height,
    priority,
    loading,
    placeholder,
    blurDataURL,
    quality,
    sizes,
  }
}

/**
 * Convert image to WebP format (client-side)
 */
export async function convertToWebP(file: File): Promise<Blob | null> {
  if (typeof window === 'undefined') return null

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }

        ctx.drawImage(img, 0, 0)

        canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85)
      }

      img.src = e.target?.result as string
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Get responsive image sizes based on container
 */
export function getResponsiveSizes(
  containerType: 'full' | 'half' | 'third' | 'quarter' = 'full'
): string {
  const sizeMap = {
    full: '100vw',
    half: '(max-width: 768px) 100vw, 50vw',
    third: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
    quarter:
      '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw',
  }

  return sizeMap[containerType]
}
