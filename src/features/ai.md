# Features Directory

This directory contains feature-specific code organized by functionality domain. Each feature has its own folder with components, utilities, and data related to that specific feature.

## Structure

Each feature follows this structure:
- `/components` - React components specific to the feature
- `/utils` - Utility functions and business logic
- `/data` - Data models, constants, and mock data
- `/hooks` - Custom React hooks (if needed)
- `/services` - API services related to the feature (if needed)
- `/context` - React context providers (if needed)
- `ai.md` - Documentation about the feature for AI tools

## Current Features

### Production

The production feature handles the bakery's production planning and preparation processes. It provides tools for:
- Planning Saturday special baking production
- Calculating recipe ingredients and quantities
- Managing bakery staff's production workflows
- Tracking production needs based on orders

See `/features/production/ai.md` for more details.

## Adding New Features

To add a new feature:
1. Create a new directory in `features/`
2. Follow the standard structure
3. Add an `ai.md` file explaining the feature
4. Import and use the feature components in the appropriate app routes

## Feature Integration

Features are integrated into the app routing system while maintaining separation of concerns:
- Features export components that are consumed by app routes
- Business logic remains in the feature directory
- App routes handle page layout and feature composition