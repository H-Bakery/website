import { render } from '@testing-library/react'

import FeatureCatalog from './feature-catalog'

describe('FeatureCatalog', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FeatureCatalog />)
    expect(baseElement).toBeTruthy()
  })
})
