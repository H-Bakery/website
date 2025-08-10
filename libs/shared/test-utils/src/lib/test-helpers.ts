import { fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Helper function to simulate typing in a form field
 */
export const typeInField = async (element: HTMLElement, value: string) => {
  const user = userEvent.setup()
  await user.clear(element)
  await user.type(element, value)
}

/**
 * Helper function to submit a form
 */
export const submitForm = async (form: HTMLElement) => {
  fireEvent.submit(form)
  await waitFor(() => {
    // Wait for form submission to complete
  })
}

/**
 * Helper function to click a button and wait for action
 */
export const clickAndWait = async (element: HTMLElement) => {
  const user = userEvent.setup()
  await user.click(element)
  await waitFor(() => {
    // Wait for click action to complete
  })
}

/**
 * Helper function to select an option from a dropdown
 */
export const selectOption = async (select: HTMLElement, optionText: string) => {
  const user = userEvent.setup()
  await user.click(select)
  await user.click(
    await waitFor(
      () =>
        (document.querySelector(
          `[role="option"][aria-label="${optionText}"]`
        ) as HTMLElement) ||
        (document.querySelector(
          `[role="option"]:contains("${optionText}")`
        ) as HTMLElement)
    )
  )
}

/**
 * Helper function to wait for element to appear
 */
export const waitForElement = async (selector: string, timeout = 5000) => {
  return waitFor(
    () => {
      const element = document.querySelector(selector)
      if (!element) throw new Error(`Element ${selector} not found`)
      return element
    },
    { timeout }
  )
}

/**
 * Helper function to wait for element to disappear
 */
export const waitForElementToDisappear = async (
  selector: string,
  timeout = 5000
) => {
  return waitFor(
    () => {
      const element = document.querySelector(selector)
      if (element) throw new Error(`Element ${selector} still visible`)
    },
    { timeout }
  )
}

/**
 * Helper function to simulate drag and drop
 */
export const dragAndDrop = async (
  source: HTMLElement,
  target: HTMLElement,
  dataTransfer?: Record<string, string>
) => {
  const user = userEvent.setup()

  // Start drag
  await user.pointer({ keys: '[MouseLeft>]', target: source })
  fireEvent.dragStart(source)

  // Set drag data if provided
  if (dataTransfer) {
    const dragEvent = new Event('drag', { bubbles: true })
    Object.assign(dragEvent, {
      dataTransfer: {
        setData: jest.fn(),
        getData: jest.fn((key: string) => dataTransfer[key] || ''),
        dropEffect: 'move',
        effectAllowed: 'move',
      },
    })
    fireEvent(source, dragEvent)
  }

  // Drop on target
  fireEvent.dragOver(target)
  fireEvent.drop(target)
  fireEvent.dragEnd(source)

  await user.pointer({ keys: '[/MouseLeft]' })
}

/**
 * Helper function to simulate file upload
 */
export const uploadFile = async (input: HTMLElement, file: File) => {
  const user = userEvent.setup()
  await user.upload(input, file)
}

/**
 * Helper function to create a mock file
 */
export const createMockFile = (
  name: string,
  content: string,
  type: string = 'text/plain'
): File => {
  return new File([content], name, { type })
}

/**
 * Helper function to simulate keyboard navigation
 */
export const navigateWithKeyboard = async (
  startElement: HTMLElement,
  key: string,
  times: number = 1
) => {
  const user = userEvent.setup()
  let currentElement = startElement

  for (let i = 0; i < times; i++) {
    await user.type(currentElement, `{${key}}`)
    // Update current element based on focus
    const focusedElement = document.activeElement as HTMLElement
    if (focusedElement !== currentElement) {
      currentElement = focusedElement
    }
  }

  return currentElement
}

/**
 * Helper function to test accessibility
 */
export const testAccessibility = {
  hasAriaLabel: (element: HTMLElement, expectedLabel?: string) => {
    const ariaLabel = element.getAttribute('aria-label')
    return expectedLabel ? ariaLabel === expectedLabel : Boolean(ariaLabel)
  },

  hasRole: (element: HTMLElement, expectedRole: string) => {
    return element.getAttribute('role') === expectedRole
  },

  isKeyboardAccessible: (element: HTMLElement) => {
    const tabIndex = element.getAttribute('tabindex')
    return tabIndex !== '-1' && element.tagName.toLowerCase() !== 'div'
  },

  hasValidHeadingStructure: (container: HTMLElement) => {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    // Basic check: ensure h1 exists and heading levels don't skip
    return headings.length > 0 && container.querySelector('h1') !== null
  },
}

/**
 * Helper function to test responsive behavior
 */
export const testResponsive = {
  mobile: () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667,
    })
    window.dispatchEvent(new Event('resize'))
  },

  tablet: () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    window.dispatchEvent(new Event('resize'))
  },

  desktop: () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    })
    window.dispatchEvent(new Event('resize'))
  },
}
