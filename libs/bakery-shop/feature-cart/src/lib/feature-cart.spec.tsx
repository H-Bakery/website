import { render } from '@testing-library/react'

import FeatureCart from './feature-cart'

describe('FeatureCart', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FeatureCart />)
    expect(baseElement).toBeTruthy()
  })
})
