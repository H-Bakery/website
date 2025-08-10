// Mock logger first
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock marked module - v4 uses function directly
jest.mock('marked', () => jest.fn((content) => `<h1>Mocked HTML</h1>`));

// Mock the recipe parser module
jest.mock('../../utils/recipeParser');

const recipeController = require('../../controllers/recipeController');
const recipeParser = require('../../utils/recipeParser');

describe('Recipe Controller', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      params: {},
      body: {},
      query: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  describe('getAllRecipes', () => {
    it('should return all recipes successfully', async () => {
      const mockRecipes = [
        { slug: 'recipe1', title: 'Recipe 1', category: 'cakes' },
        { slug: 'recipe2', title: 'Recipe 2', category: 'breads' }
      ];

      recipeParser.getAllRecipes.mockResolvedValue(mockRecipes);

      await recipeController.getAllRecipes(req, res);

      expect(recipeParser.getAllRecipes).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockRecipes
      });
    });

    it('should filter recipes by category', async () => {
      const allRecipes = [
        { slug: 'cake1', category: 'cakes', tags: [] },
        { slug: 'bread1', category: 'breads', tags: [] },
        { slug: 'cake2', category: 'cakes', tags: [] }
      ];

      recipeParser.getAllRecipes.mockResolvedValue(allRecipes);
      req.query.category = 'cakes';

      await recipeController.getAllRecipes(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: [
          { slug: 'cake1', category: 'cakes', tags: [] },
          { slug: 'cake2', category: 'cakes', tags: [] }
        ]
      });
    });

    it('should filter recipes by tag', async () => {
      const allRecipes = [
        { slug: 'recipe1', tags: ['chocolate', 'dessert'] },
        { slug: 'recipe2', tags: ['bread', 'sourdough'] },
        { slug: 'recipe3', tags: ['chocolate', 'cake'] }
      ];

      recipeParser.getAllRecipes.mockResolvedValue(allRecipes);
      req.query.tag = 'chocolate';

      await recipeController.getAllRecipes(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: [
          { slug: 'recipe1', tags: ['chocolate', 'dessert'] },
          { slug: 'recipe3', tags: ['chocolate', 'cake'] }
        ]
      });
    });

    it('should handle errors', async () => {
      recipeParser.getAllRecipes.mockRejectedValue(new Error('Database error'));

      await recipeController.getAllRecipes(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve recipes'
      });
    });
  });

  describe('getRecipeBySlug', () => {
    it('should return a recipe by slug', async () => {
      const mockRecipe = {
        slug: 'chocolate-cake',
        title: 'Chocolate Cake',
        content: 'Recipe content'
      };

      req.params.slug = 'chocolate-cake';
      recipeParser.getRecipeBySlug.mockResolvedValue(mockRecipe);

      await recipeController.getRecipeBySlug(req, res);

      expect(recipeParser.getRecipeBySlug).toHaveBeenCalledWith('chocolate-cake');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRecipe
      });
    });

    it('should return 404 if recipe not found', async () => {
      req.params.slug = 'non-existent';
      recipeParser.getRecipeBySlug.mockResolvedValue(null);

      await recipeController.getRecipeBySlug(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Recipe not found'
      });
    });

    it('should handle errors', async () => {
      req.params.slug = 'chocolate-cake';
      recipeParser.getRecipeBySlug.mockRejectedValue(new Error('Read error'));

      await recipeController.getRecipeBySlug(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve recipe'
      });
    });
  });

  describe('createRecipe', () => {
    it('should create a new recipe', async () => {
      const recipeData = {
        title: 'New Recipe',
        content: 'Recipe content',
        category: 'cakes'
      };

      const createdRecipe = {
        ...recipeData,
        slug: 'new-recipe',
        created_at: expect.any(String),
        updated_at: expect.any(String)
      };

      req.body = recipeData;
      recipeParser.createRecipe.mockResolvedValue(createdRecipe);

      await recipeController.createRecipe(req, res);

      expect(recipeParser.createRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Recipe',
          content: 'Recipe content',
          category: 'cakes',
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdRecipe
      });
    });

    it('should validate required fields', async () => {
      req.body = { title: 'Missing Content' };

      await recipeController.createRecipe(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Title and content are required'
      });
      expect(recipeParser.createRecipe).not.toHaveBeenCalled();
    });

    it('should handle duplicate recipe error', async () => {
      req.body = { title: 'Duplicate', content: 'Content' };
      recipeParser.createRecipe.mockRejectedValue(
        new Error('Recipe with this slug already exists')
      );

      await recipeController.createRecipe(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Recipe with this slug already exists'
      });
    });
  });

  describe('updateRecipe', () => {
    it('should update an existing recipe', async () => {
      const existingRecipe = {
        slug: 'chocolate-cake',
        title: 'Chocolate Cake',
        content: 'Old content',
        created_at: '2024-01-01'
      };

      const updateData = {
        title: 'Updated Chocolate Cake',
        content: 'New content'
      };

      req.params.slug = 'chocolate-cake';
      req.body = updateData;

      recipeParser.getRecipeBySlug.mockResolvedValue(existingRecipe);
      recipeParser.updateRecipe.mockResolvedValue({
        ...existingRecipe,
        ...updateData,
        updated_at: expect.any(String)
      });

      await recipeController.updateRecipe(req, res);

      expect(recipeParser.updateRecipe).toHaveBeenCalledWith(
        'chocolate-cake',
        expect.objectContaining({
          title: 'Updated Chocolate Cake',
          content: 'New content',
          created_at: '2024-01-01',
          updated_at: expect.any(String)
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          title: 'Updated Chocolate Cake',
          content: 'New content'
        })
      });
    });

    it('should return 404 if recipe not found', async () => {
      req.params.slug = 'non-existent';
      recipeParser.getRecipeBySlug.mockResolvedValue(null);

      await recipeController.updateRecipe(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Recipe not found'
      });
      expect(recipeParser.updateRecipe).not.toHaveBeenCalled();
    });
  });

  describe('deleteRecipe', () => {
    it('should delete an existing recipe', async () => {
      req.params.slug = 'chocolate-cake';
      recipeParser.deleteRecipe.mockResolvedValue(true);

      await recipeController.deleteRecipe(req, res);

      expect(recipeParser.deleteRecipe).toHaveBeenCalledWith('chocolate-cake');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 404 if recipe not found', async () => {
      req.params.slug = 'non-existent';
      recipeParser.deleteRecipe.mockResolvedValue(false);

      await recipeController.deleteRecipe(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Recipe not found'
      });
    });
  });

  describe('getCategories', () => {
    it('should return unique categories', async () => {
      const mockRecipes = [
        { category: 'cakes' },
        { category: 'breads' },
        { category: 'cakes' },
        { category: 'desserts' }
      ];

      recipeParser.getAllRecipes.mockResolvedValue(mockRecipes);

      await recipeController.getCategories(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: ['cakes', 'breads', 'desserts']
      });
    });
  });

  describe('getTags', () => {
    it('should return unique sorted tags', async () => {
      const mockRecipes = [
        { tags: ['chocolate', 'dessert'] },
        { tags: ['bread', 'sourdough'] },
        { tags: ['chocolate', 'cake'] },
        { tags: null }
      ];

      recipeParser.getAllRecipes.mockResolvedValue(mockRecipes);

      await recipeController.getTags(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: ['bread', 'cake', 'chocolate', 'dessert', 'sourdough']
      });
    });
  });
});