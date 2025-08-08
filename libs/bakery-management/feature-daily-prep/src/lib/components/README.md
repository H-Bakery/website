# Daily Prep Components

This directory contains the refactored daily preparation management interface components for the bakery administration system.

## Structure

```
dailyPrep/
├── Header/
│   └── DailyPrepHeader.tsx          # Main header with title, date info, and action buttons
├── ProgressOverview/
│   └── ProgressOverview.tsx         # Progress tracking and date navigation
├── PrepSections/
│   ├── PrepSectionsView.tsx         # Container for prep task sections
│   └── EnhancedPrepTaskCard.tsx     # Enhanced prep task card with edit mode
├── BakingSchedule/
│   └── BakingScheduleView.tsx       # Standard baking schedule management
├── AdditionalProduction/
│   └── AdditionalProductionView.tsx # Additional production requests
├── PrintUtils/
│   └── printUtils.ts                # Print functionality for plans
├── DailyPrepTabs.tsx                # Tab navigation component
├── index.ts                         # Export barrel
└── README.md                        # This file
```

## Components

### DailyPrepHeader
- Displays page title and date information
- Contains action buttons for edit mode, refresh, print, and save
- Shows whether data is from specific file or generated

### ProgressOverview  
- Shows overall completion progress
- Date picker and navigation
- Quick actions and status alerts

### PrepSectionsView
- Container for all preparation task sections
- Uses EnhancedPrepTaskCard for individual sections
- Handles edit mode and section expansion

### EnhancedPrepTaskCard
- Enhanced version of PrepTaskCard with edit functionality
- Supports quantity editing in edit mode
- Stock status indicators and production requests
- Collapsible sections with progress tracking

### BakingScheduleView
- Manages standard baking schedules for cakes and bread
- Edit mode for quantity adjustments
- Separate cards for different categories

### AdditionalProductionView
- Displays additional production requests
- Shows urgency levels and reasons
- Print summary functionality

### DailyPrepTabs
- Tab navigation between different views
- Shows badge counts for additional production items
- Context-sensitive action buttons

## Hooks

The components use the `useDailyPrep` hook located in `/src/hooks/useDailyPrep.ts` which provides:

- State management for all prep data
- Complex actions like loading tasks and updating quantities
- Computed values like progress calculation

## Print Utils

The `PrintUtils` class provides static methods for generating printable documents:

- `printProductionPlan()` - Production plan for prep team
- `printBakersPlan()` - Baking plan for night bakers

## Usage

```tsx
import { DailyPrepPage } from './DailyPrepPage'

// The main page component handles all orchestration
export default DailyPrepPage
```

## Key Features

1. **Modular Design**: Each component has a single responsibility
2. **Type Safety**: Full TypeScript support with proper interfaces
3. **Reusability**: Components can be easily reused or extended
4. **Performance**: Uses React best practices and efficient state management
5. **Accessibility**: Material UI components with proper ARIA labels
6. **Print Support**: Professional print layouts for both teams
7. **Edit Mode**: In-place editing with proper validation
8. **Stock Management**: Integration with inventory tracking
9. **German Localization**: All text in German for local bakery use

## Development Notes

- All components are marked with `'use client'` for Next.js App Router
- Uses Material UI for consistent design system
- Proper error boundaries and loading states
- Follows existing codebase patterns and conventions
- Clean separation between UI logic and business logic

## Future Enhancements

- Add drag-and-drop for reordering tasks
- Implement real-time collaboration features
- Add offline support with local storage
- Enhance mobile responsiveness
- Add more detailed analytics and reporting