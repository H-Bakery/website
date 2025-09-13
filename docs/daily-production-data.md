# Daily Production Data Documentation

## Overview

The bakery management system tracks daily production quantities across multiple product categories. This document provides a comprehensive overview of the daily production data, where it comes from, and how it's structured in both the old and new systems.

## Current Daily Production Targets

### Standard Products (from API)

#### Breads (Brot)

- **Sauerteigbrot**: 30 pieces daily
- **Vollkornbrot**: 25 pieces daily
- **Baguette**: 40 pieces daily
- **Ciabatta**: 20 pieces daily

#### Pastries (Gebäck)

- **Croissant**: 50 pieces daily
- **Brezel**: 70 pieces daily
- **Apfelstrudel**: 15 pieces daily

#### Cakes (Kuchen)

- **Schwarzwälder Kirschtorte**: 3 pieces daily
- **Käsekuchen**: 5 pieces daily
- **Apfelkuchen**: 7 pieces daily

### Daily Prep Production Data

The daily prep system manages production quantities for preparation tasks. Data comes from the `PrepTaskLoader` service.

#### Pastry Cart Items (Kaffeestückchen)

Standard daily quantities (adjusted by day of week):

| Product                 | Base Quantity | Tray # |
| ----------------------- | ------------- | ------ |
| Schokocroissant         | 10            | 1      |
| Croissant               | 12            | 2      |
| Schoko-Vanille Hörnchen | 7             | 3      |
| Quarktaschen            | 7             | 4      |
| Nusschnecke             | 6             | 5      |
| Pudding Schnecke        | 6             | 5      |
| Pudding Plunder         | 7             | 6      |
| Kirschtaschen           | 7             | 7      |
| Apfeltaschen            | 7             | 7      |
| Franzbrötchen           | 5             | 8      |
| Marzipanschleifen       | 6             | 9      |
| Laugenstangen           | 8             | 10     |
| Einback                 | 15            | 11-13  |
| Streusel                | 8             | 14     |
| Nougatplunder           | 36            | 15-17  |

#### Standard Baking Schedule

Cakes produced daily:

- **Marmorkuchen**: 3 pieces
- **Sahnetorte**: 3 pieces
- **Käsekuchen mit Mandarinen**: 2 pieces
- **Kirsch-Streuselkuchen**: 2 pieces (for next day, 06:30)

Standard bread production:

- **Kornbrot**: 6 Liters
- **Holzlukenbrot**: 6 Liters

### Day-of-Week Variations

Production quantities are adjusted based on the day of week:

| Day                      | Pastry Multiplier | Cakes Multiplier | Bread Multiplier |
| ------------------------ | ----------------- | ---------------- | ---------------- |
| Sunday (prep for Monday) | 0.7               | 0.8              | 0.8              |
| Monday                   | 0.8               | 0.9              | 0.9              |
| Tuesday                  | 1.0               | 1.0              | 1.0              |
| Wednesday                | 0.9               | 1.0              | 1.0              |
| Thursday                 | 1.0               | 1.0              | 1.0              |
| Friday                   | 1.2               | 1.1              | 1.1              |
| Saturday                 | 1.3               | 1.2              | 1.2              |

### Daily Bread Variations

Additional breads produced based on day:

**Monday:**

- Mischbrot: 3 Liters
- Haferbrot: 1.5 Liters

**Tuesday:**

- Vollgut Brot: 2 Liters
- Buttermilchbrot: 3 Liters

**Wednesday:**

- Mischbrot: 3 Liters
- Roggenbrot: 2 Liters

**Thursday:**

- Haferbrot: 1.5 Liters
- Dinkelwrappenbrot: 2 Liters

**Friday:**

- Buttermilchbrot: 3 Liters
- Vollgut Brot: 2 Liters
- Mischbrot: 4 Liters

**Saturday:**

- Mischbrot: 4 Liters
- Vollgut Brot: 3 Liters
- Roggenbrot: 2 Liters

**Sunday (prep for Monday):**

- Mischbrot: 2 Liters

### Saturday Production (Hefezopf Products)

Special production system for Saturday Hefezopf products:

| Product                  | Weight | Filling           |
| ------------------------ | ------ | ----------------- |
| Hefezopf Plain           | 900g   | None              |
| Mini Hefezopf            | 600g   | None              |
| Hefekranz Nuss           | 1800g  | 1200g nut filling |
| Hefekranz Schoko         | 1800g  | 1200g chocolate   |
| Hefekranz Pudding        | 1800g  | 1200g custard     |
| Hefekranz Marzipan       | 1800g  | 1200g marzipan    |
| Hefekranz Quark          | 1800g  | 1200g cheese      |
| Gefüllter Zopf (various) | 500g   | 450g filling      |
| Rosinenbrot              | 600g   | With raisins      |
| Streuselkuchen Klein     | 500g   | None              |
| Streuselkuchen Groß      | 900g   | None              |

## Data Sources

### Old System (Archive)

Location: `src-archive/src-20250806/`

1. **PrepTaskLoader Service** (`services/prepTaskLoader.ts`)

   - Contains hardcoded configuration data
   - Implements day-variation logic
   - Generates prep tasks based on date

2. **Production Calculator** (`features/production/utils/productionCalculator.ts`)
   - Calculates dough requirements
   - Manages filling quantities
   - Optimizes batch sizes (40kg dough batches)

### New System (Nx Monorepo)

Location: `libs/bakery-management/feature-daily-prep/`

1. **PrepTaskLoader Service** (`src/lib/services/prepTaskLoader.ts`)

   - Migrated from old system
   - Same configuration data structure
   - Enhanced with TypeScript types

2. **Type Definitions** (`src/lib/types/prepTask.ts`)

   - PrepSection, PrepTaskItem interfaces
   - BakingItem, AdditionalProductionItem types
   - PrepIngredient interface

3. **MarkdownParser Service** (`src/lib/services/markdownParser.ts`)
   - Parses markdown files for date-specific overrides
   - Converts between markdown and PrepSection format

## Special Preparations

### Sourdough Variants

Alternates between two variants based on day:

- **Mischbrot**: 28g starter, 188g water, 378g wheat flour
- **Buttermilchbrot**: Same ratios, different fermentation

### Brühstück (Pre-scald)

Prepared on Tuesday, Thursday, Saturday:

- 400g sunflower seeds
- 400g flaxseed
- 800ml boiling water

### Meatloaf

Prepared on Monday, Wednesday, Friday:

- Remove from freezer
- Score and remove casing
- Cook at 105°C

## Stock Management

The system simulates stock levels with these distributions:

- 60% of items: Sufficient stock
- 25% of items: Low stock
- 10% of items: Critical stock
- 5% of items: Empty stock

## Integration Points

### API Endpoints (Planned)

- `GET /api/production/daily-summary` - Daily production overview
- `GET /api/production/targets` - Production targets by product
- `POST /api/production/actual` - Record actual production
- `GET /api/production/report/:date` - Historical production data

### Frontend Pages

- `/admin/bakery/daily-prep` - Daily preparation checklist
- `/admin/bakery/saturday-production` - Saturday Hefezopf production
- `/admin/orders/baking-list` - Daily baking list

## Future Enhancements

1. **Database Integration**

   - Move hardcoded data to database
   - Track actual vs. planned production
   - Historical production analytics

2. **Real-time Updates**

   - WebSocket integration for live updates
   - Multi-user coordination
   - Production status tracking

3. **Inventory Integration**

   - Connect with actual inventory levels
   - Automatic adjustment of production quantities
   - Waste tracking and optimization

4. **Reporting**
   - Production efficiency reports
   - Cost analysis
   - Trend analysis and forecasting

## Summary

The daily production system manages approximately:

- **115 breads** per day (varying by day)
- **135 pastries** per day (base quantities)
- **10 cakes** per day
- **Special Saturday production** of Hefezopf products

Total daily production varies from approximately 200-350 items depending on the day of week, with Saturday being the highest production day (130% of base quantities for pastries).
