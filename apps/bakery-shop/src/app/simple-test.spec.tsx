import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Simple test to verify basic setup
describe('Simple Test', () => {
  it('should render a basic component', () => {
    const SimpleComponent = () => <div data-testid="test">Hello World</div>

    render(<SimpleComponent />)

    expect(screen.getByTestId('test')).toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('should handle basic React functionality', () => {
    const Counter = () => {
      const [count, setCount] = React.useState(0)

      return (
        <div>
          <span data-testid="count">{count}</span>
          <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
      )
    }

    render(<Counter />)

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })
})
