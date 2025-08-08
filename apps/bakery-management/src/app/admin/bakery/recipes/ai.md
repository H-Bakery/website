# Recipe Management

This section allows for the management of professional bakery recipes. Administrators can create, view, update, and delete recipes. Each recipe can include details such as ingredients, preparation and cooking instructions, serving sizes, and images.

## Key Features

- **Recipe CRUD:** Create, Read, Update, and Delete recipes.
- **Ingredient Management:** List ingredients with quantities for each recipe.
- **Instruction Steps:** Detail the preparation and cooking process.
- **Review Management:** View and manage customer reviews associated with each recipe. Admins can add, edit, or delete reviews.

## Data Structure

Recipe and review data structures are defined in `src/services/types.ts`.

## UI Components

- Recipe list and detail views are handled by components in `src/components/bakery/recipes/`.
- Review display and forms are handled by components in `src/components/bakery/reviews/`.
