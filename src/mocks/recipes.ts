import { Recipe, Review } from '../services/types'

export const mockReviews: Review[] = [
  {
    id: 'rev1',
    recipeId: 'recipe1',
    author: 'Jane Doe',
    rating: 5,
    comment: 'Absolutely delicious!',
    date: new Date().toISOString(),
  },
  {
    id: 'rev2',
    recipeId: 'recipe1',
    author: 'John Smith',
    rating: 4,
    comment: 'Very good, will make again.',
    date: new Date().toISOString(),
  },
  {
    id: 'rev3',
    recipeId: 'recipe2',
    author: 'Alice Brown',
    rating: 5,
    comment: 'My new favorite cake!',
    date: new Date().toISOString(),
  },
  {
    id: 'rev4',
    recipeId: 'recipe3',
    author: 'Bob Green',
    rating: 3,
    comment: 'Good, but a bit dry.',
    date: new Date().toISOString(),
  },
]

export const mockRecipes: Recipe[] = [
  {
    id: 'recipe1',
    name: 'Classic Chocolate Cake',
    description: 'A rich and moist chocolate cake perfect for any occasion.',
    ingredients: [
      { name: 'All-purpose flour', quantity: '1 1/2 cups' },
      { name: 'Sugar', quantity: '1 cup' },
      { name: 'Cocoa powder', quantity: '1/2 cup' },
      { name: 'Baking soda', quantity: '1 tsp' },
      { name: 'Salt', quantity: '1/2 tsp' },
      { name: 'Egg', quantity: '1' },
      { name: 'Milk', quantity: '1 cup' },
      { name: 'Vegetable oil', quantity: '1/2 cup' },
      { name: 'Vanilla extract', quantity: '1 tsp' },
    ],
    instructions: [
      'Preheat oven to 350°F (175°C).',
      'Grease and flour a 9-inch round cake pan.',
      'In a large bowl, whisk together flour, sugar, cocoa powder, baking soda, and salt.',
      'In another bowl, whisk together egg, milk, oil, and vanilla extract.',
      'Pour wet ingredients into dry ingredients and mix until just combined.',
      'Pour batter into prepared pan and bake for 30-35 minutes, or until a toothpick inserted into the center comes out clean.',
      'Let cool in pan for 10 minutes before transferring to a wire rack to cool completely.',
    ],
    category: 'Cakes',
    prepTime: '20 minutes',
    cookTime: '35 minutes',
    servings: 8,
    image: '/images/mock/chocolate-cake.jpg', // Placeholder image path
    reviews: mockReviews.filter((r) => r.recipeId === 'recipe1'),
  },
  {
    id: 'recipe2',
    name: 'Sourdough Bread',
    description: 'A crusty artisan sourdough bread with a chewy crumb.',
    ingredients: [
      { name: 'Sourdough starter (active)', quantity: '100g (1/2 cup)' },
      { name: 'Bread flour', quantity: '500g (about 4 cups)' },
      { name: 'Water (lukewarm)', quantity: '350g (1 1/2 cups)' },
      { name: 'Salt', quantity: '10g (2 tsp)' },
    ],
    instructions: [
      'Feed your starter 4-12 hours before mixing the dough.',
      'In a large bowl, mix flour and water (autolyse) for 30 minutes to 1 hour.',
      'Add starter and salt to the dough. Mix thoroughly using your hands or a stand mixer for 5-7 minutes.',
      'Perform a series of stretch and folds every 30-45 minutes for the first 2-3 hours.',
      'Bulk ferment for 3-5 hours at room temperature, or until dough has risen by about 30-50%.',
      'Preshape the dough, let it rest for 20-30 minutes, then shape it into its final form.',
      'Proof in a banneton or bowl, covered, at room temperature for 1-2 hours or in the refrigerator for 12-18 hours.',
      'Preheat oven with a Dutch oven inside to 450°F (230°C).',
      'Score the dough, then bake in the Dutch oven covered for 20 minutes, then uncovered for 20-25 minutes, or until deeply golden brown.',
    ],
    category: 'Breads',
    prepTime: '3 hours (plus starter feeding and long fermentation)',
    cookTime: '45 minutes',
    servings: 12, // 1 loaf
    image: '/images/mock/sourdough-bread.jpg', // Placeholder image path
    reviews: mockReviews.filter((r) => r.recipeId === 'recipe2'),
  },
  {
    id: 'recipe3',
    name: 'Blueberry Muffins',
    description:
      'Classic blueberry muffins with a tender crumb and bursting with fresh blueberries.',
    ingredients: [
      { name: 'All-purpose flour', quantity: '2 cups (250g)' },
      { name: 'Granulated sugar', quantity: '3/4 cup (150g)' },
      { name: 'Baking powder', quantity: '2 tsp' },
      { name: 'Salt', quantity: '1/2 tsp' },
      { name: 'Egg', quantity: '1 large' },
      { name: 'Milk', quantity: '3/4 cup (180ml)' },
      { name: 'Unsalted butter, melted', quantity: '1/2 cup (113g)' },
      { name: 'Vanilla extract', quantity: '1 tsp' },
      { name: 'Fresh blueberries', quantity: '1 1/2 cups (200g)' },
    ],
    instructions: [
      'Preheat oven to 400°F (200°C). Line a 12-cup muffin tin with paper liners.',
      'In a large bowl, whisk together flour, sugar, baking powder, and salt.',
      'In a separate medium bowl, whisk together the egg, milk, melted butter, and vanilla extract.',
      'Pour the wet ingredients into the dry ingredients and stir until just combined. Do not overmix a few lumps are okay',
      'Gently fold in the blueberries.',
      'Divide the batter evenly among the prepared muffin cups.',
      'Bake for 18-20 minutes, or until a toothpick inserted into the center of a muffin comes out clean.',
      'Let the muffins cool in the tin for a few minutes before transferring them to a wire rack to cool completely.',
    ],
    category: 'Muffins',
    prepTime: '15 minutes',
    cookTime: '20 minutes',
    servings: 12,
    image: '/images/mock/blueberry-muffins.jpg',
    reviews: mockReviews.filter((r) => r.recipeId === 'recipe3'),
  },
]
