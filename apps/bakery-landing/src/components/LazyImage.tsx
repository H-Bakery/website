'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image, { ImageProps } from 'next/image'
import { Box } from '@mui/material'

interface LazyImageProps extends Omit<ImageProps, 'src' | 'placeholder'> {
  src: string
  placeholderSrc?: string
  fallbackSrc?: string
  observerOptions?: IntersectionObserverInit
  sizes?: string
  srcSet?: {
    webp?: string[]
    jpg?: string[]
  }
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  placeholderSrc,
  fallbackSrc,
  alt,
  observerOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.01,
  },
  sizes = '100vw',
  srcSet,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholderSrc || '')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!imgRef.current || typeof window === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      })
    }, observerOptions)

    observer.observe(imgRef.current)

    return () => {
      observer.disconnect()
    }
  }, [observerOptions])

  useEffect(() => {
    if (isInView && !isLoaded) {
      // Preload the image
      const img = new window.Image()

      img.onload = () => {
        setImageSrc(src)
        setIsLoaded(true)
      }

      img.onerror = () => {
        setError(true)
        if (fallbackSrc) {
          setImageSrc(fallbackSrc)
        }
      }

      img.src = src
    }
  }, [isInView, src, fallbackSrc, isLoaded])

  return (
    <Box
      ref={imgRef}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: placeholderSrc ? 'transparent' : 'grey.100',
        transition: 'opacity 0.3s ease-in-out',
        '& img': {
          transition: 'filter 0.3s ease-in-out, transform 0.3s ease-in-out',
          filter: isLoaded ? 'blur(0)' : 'blur(20px)',
          transform: isLoaded ? 'scale(1)' : 'scale(1.1)',
        },
      }}
    >
      {srcSet && isInView ? (
        <picture>
          {srcSet.webp && (
            <source
              type="image/webp"
              srcSet={srcSet.webp.join(', ')}
              sizes={sizes}
            />
          )}
          {srcSet.jpg && (
            <source
              type="image/jpeg"
              srcSet={srcSet.jpg.join(', ')}
              sizes={sizes}
            />
          )}
          <img
            src={imageSrc || src}
            alt={alt}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setError(true)
              if (fallbackSrc) {
                setImageSrc(fallbackSrc)
              }
            }}
          />
        </picture>
      ) : (
        imageSrc && (
          <Image
            {...props}
            src={imageSrc}
            alt={alt}
            loading="lazy"
            quality={85}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setError(true)
              if (fallbackSrc) {
                setImageSrc(fallbackSrc)
              }
            }}
          />
        )
      )}

      {/* Loading skeleton */}
      {!isLoaded && !placeholderSrc && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            '@keyframes shimmer': {
              '0%': {
                backgroundPosition: '200% 0',
              },
              '100%': {
                backgroundPosition: '-200% 0',
              },
            },
          }}
        />
      )}
    </Box>
  )
}

// Hook for responsive images
export const useResponsiveImage = (basePath: string, extension = 'jpg') => {
  const [deviceSize, setDeviceSize] = useState<'small' | 'medium' | 'large'>(
    'medium'
  )

  useEffect(() => {
    const updateDeviceSize = () => {
      const width = window.innerWidth
      if (width < 640) {
        setDeviceSize('small')
      } else if (width < 1024) {
        setDeviceSize('medium')
      } else {
        setDeviceSize('large')
      }
    }

    updateDeviceSize()
    window.addEventListener('resize', updateDeviceSize)

    return () => window.removeEventListener('resize', updateDeviceSize)
  }, [])

  const getSrcSet = () => {
    const baseUrl = basePath.replace(`.${extension}`, '')

    return {
      webp: [
        `${baseUrl}-small.webp 400w`,
        `${baseUrl}-medium.webp 800w`,
        `${baseUrl}-large.webp 1200w`,
        `${baseUrl}-xlarge.webp 1920w`,
      ],
      jpg: [
        `${baseUrl}-small.jpg 400w`,
        `${baseUrl}-medium.jpg 800w`,
        `${baseUrl}-large.jpg 1200w`,
        `${baseUrl}-xlarge.jpg 1920w`,
      ],
    }
  }

  const getSizes = () => {
    return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
  }

  return {
    deviceSize,
    srcSet: getSrcSet(),
    sizes: getSizes(),
  }
}

export default LazyImage
