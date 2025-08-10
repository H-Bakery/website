# Recipes Library

This library contains the recipes domain functionality for the bakery API.

## Features

- Recipe management (CRUD operations)
- Ingredient management
- Recipe categories
- Scaling calculations
- Production planning integration

## Usage

```typescript
import { recipeRoutes } from '@bakery/api/recipes';

// In your Express app
app.use('/api/recipes', recipeRoutes);
```

## API Endpoints

- `GET /api/recipes` - Get all recipes
- `GET /api/recipes/:id` - Get recipe by ID
- `POST /api/recipes` - Create new recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe
- `GET /api/recipes/:id/ingredients` - Get recipe ingredients
- `GET /api/recipes/categories` - Get recipe categories
- `POST /api/recipes/:id/scale` - Calculate scaled quantities

## Running unit tests

Run `nx test recipes` to execute the unit tests via [Jest](https://jestjs.io).