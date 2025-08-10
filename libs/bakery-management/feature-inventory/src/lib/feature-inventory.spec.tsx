import { render } from '@testing-library/react'

import FeatureInventory from './feature-inventory'

describe('FeatureInventory', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FeatureInventory />)
    expect(baseElement).toBeTruthy()
  })
})
