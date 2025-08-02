# Mock Recipe Data

This file (`recipes.ts`) provides mock data for recipes and reviews. It is used during development to populate the recipe management interface when a backend API is not yet integrated or for testing purposes.

## Structure

- `mockReviews`: An array of sample `Review` objects.
- `mockRecipes`: An array of sample `Recipe` objects. Each recipe can embed its associated reviews from `mockReviews`.

This data is intended to be representative of the actual data structures defined in `src/services/types.ts`.
