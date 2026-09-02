import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import NavigationButton from './NavigationButton'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('NavigationButton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const defaultProps = {
    href: '/about',
  }

  it('renders button with label', () => {
    renderWithTheme(
      <NavigationButton {...defaultProps}>Über uns</NavigationButton>
    )

    expect(screen.getByText('Über uns')).toBeInTheDocument()
  })

  it('navigates to correct route on click', () => {
    renderWithTheme(
      <NavigationButton {...defaultProps}>Über uns</NavigationButton>
    )

    const button = screen.getByRole('button', { name: 'Über uns' })
    fireEvent.click(button)

    expect(mockPush).toHaveBeenCalledWith('/about')
  })

  it('renders with icon when provided', () => {
    const propsWithIcon = {
      ...defaultProps,
      icon: <span data-testid="test-icon">📍</span>,
    }

    renderWithTheme(
      <NavigationButton {...propsWithIcon}>Über uns</NavigationButton>
    )

    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    expect(screen.getByText('Über uns')).toBeInTheDocument()
  })

  it('applies active state when on current route', () => {
    const propsActive = {
      ...defaultProps,
      isActive: true,
    }

    const { container } = renderWithTheme(
      <NavigationButton {...propsActive}>Über uns</NavigationButton>
    )

    const button = container.querySelector('button')
    expect(button).toHaveClass('active')
  })

  it('handles external links', () => {
    const propsExternal = {
      ...defaultProps,
      href: 'https://instagram.com/baeckerei_heusser',
      isExternal: true,
    }

    renderWithTheme(
      <NavigationButton {...propsExternal}>Über uns</NavigationButton>
    )

    const link = screen.getByRole('link', { name: 'Über uns' })
    expect(link).toHaveAttribute(
      'href',
      'https://instagram.com/baeckerei_heusser'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders in different sizes', () => {
    const propsSmall = {
      ...defaultProps,
      size: 'small' as const,
    }

    const { rerender, container } = renderWithTheme(
      <NavigationButton {...propsSmall}>Über uns</NavigationButton>
    )

    let button = container.querySelector('button')
    expect(button).toHaveClass('MuiButton-sizeSmall')

    const propsLarge = {
      ...defaultProps,
      size: 'large' as const,
    }

    rerender(<NavigationButton {...propsLarge}>Über uns</NavigationButton>)

    button = container.querySelector('button')
    expect(button).toHaveClass('MuiButton-sizeLarge')
  })

  it('renders with different variants', () => {
    const propsOutline = {
      ...defaultProps,
      variant: 'outlined' as const,
    }

    const { container } = renderWithTheme(
      <NavigationButton {...propsOutline}>Über uns</NavigationButton>
    )

    const button = container.querySelector('button')
    expect(button).toHaveClass('MuiButton-outlined')
  })

  it('handles disabled state', () => {
    const propsDisabled = {
      ...defaultProps,
      disabled: true,
    }

    renderWithTheme(
      <NavigationButton {...propsDisabled}>Über uns</NavigationButton>
    )

    const button = screen.getByRole('button', { name: 'Über uns' })
    expect(button).toBeDisabled()

    fireEvent.click(button)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('renders with custom className', () => {
    const propsWithClass = {
      ...defaultProps,
      className: 'custom-nav-btn',
    }

    const { container } = renderWithTheme(
      <NavigationButton {...propsWithClass}>Über uns</NavigationButton>
    )

    const button = container.querySelector('button')
    expect(button).toHaveClass('custom-nav-btn')
  })

  it('supports keyboard navigation', async () => {
    // Enter/Leertaste lösen bei einem nativen <button> den Klick im Browser aus;
    // fireEvent.keyDown simuliert das nicht, user-event schon.
    const user = userEvent.setup()
    renderWithTheme(
      <NavigationButton {...defaultProps}>Über uns</NavigationButton>
    )

    const button = screen.getByRole('button', { name: 'Über uns' })
    button.focus()

    await user.keyboard('{Enter}')
    expect(mockPush).toHaveBeenCalledWith('/about')

    mockPush.mockClear()

    await user.keyboard(' ')
    expect(mockPush).toHaveBeenCalledWith('/about')
  })
})
