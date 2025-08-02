import '@testing-library/jest-dom'

// Mock Next.js Image component globally
jest.mock('next/image', () => {
  const MockImage = ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />
  }
  MockImage.displayName = 'Image'
  return MockImage
})

// Mock Next.js Link component globally
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

// Global test setup for UI library
