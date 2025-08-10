import { render } from '@testing-library/react'

import FeatureOrders from './feature-orders'

describe('FeatureOrders', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FeatureOrders />)
    expect(baseElement).toBeTruthy()
  })
})
