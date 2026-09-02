import * as FeatureInventory from './feature-inventory'

// `feature-inventory.tsx` ist ein Barrel ohne eigene Komponente; der alte
// Test renderte einen nicht existierenden Default-Export.
describe('FeatureInventory', () => {
  it('exportiert die Produktions-Komponenten', () => {
    expect(typeof FeatureInventory.ProductionMetricsCard).toBe('function')
    expect(typeof FeatureInventory.ResourceOptimizationPanel).toBe('function')
    expect(typeof FeatureInventory.ProductionStatusPanel).toBe('function')
  })
})
