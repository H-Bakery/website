import '@testing-library/jest-dom'
import React from 'react'

// Mock Next.js Image component globally
jest.mock('next/image', () => {
  const MockImage = ({ src, alt, ...props }: any) => {
    return React.createElement('img', { src, alt, ...props })
  }
  MockImage.displayName = 'Image'
  return MockImage
})

// Mock Next.js Link component globally
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return React.createElement('a', { href, ...props }, children)
  }
})

// Global test setup for UI library
