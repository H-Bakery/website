# Code Cleanup Notes

## Saturday Production Feature

This document outlines the major changes made as part of the code cleanup for the Saturday production feature.

### Structural Changes

1. **Relocated Components**
   - Moved from: `/components/bakery/` 
   - Moved to: `/features/production/components/`
   - Components affected: `SaturdayProductionDashboard`, `FillingPreparation`, `ProductionChecklist`

2. **Reorganized Utilities**
   - Moved from: `/utils/productionCalculator.ts`
   - Moved to: `/features/production/utils/productionCalculator.ts`
   - Enhanced with proper TypeScript types and more accurate calculations

3. **New Data Files**
   - Created data-specific files in `/features/production/data/`:
     - `doughPieces.ts` - Based on "Teigstückübersicht für Kuchen" document
     - `fillings.ts` - Based on "Füllungen für Kränze" document

4. **Added Documentation**
   - Created `ai.md` for AI context
   - Added `README.md` with feature documentation

### Functional Updates

1. **Corrected Dough Calculations**
   - Now correctly models that products are made from multiple dough pieces
   - A Kranz uses 3 pieces of 600g dough
   - A Kleiner Zopf uses 2 pieces of 300g dough
   - A Großer Zopf uses 3 pieces of 300g dough

2. **Updated Filling Specifications**
   - Gefüllte Kränze require 1200g filling per piece
   - Gefüllte Zöpfe require 450g filling per piece
   - No Schnecken on Saturdays

3. **Batch Size Corrections**
   - Dough batches are now 40kg (instead of 5kg)
   - Filling batches are standardized at 15kg

4. **Product Lineup Changes**
   - Removed: Hefeschnecken (not made on Saturdays)
   - Added: Gefüllte Zöpfe (with various fillings)

## Open Items

- Consider adding translations for all UI elements
- Add print stylesheet optimization for the checklist
- Implement server-side storage of production plans

## Migration Guide

When using the new production feature components:

1. Import from the features directory:
   ```typescript
   import { SaturdayProductionDashboard } from '@/features/production/components'
   ```

2. Reference the new calculator:
   ```typescript
   import { HefezopfCalculator } from '@/features/production/utils/productionCalculator'
   ```