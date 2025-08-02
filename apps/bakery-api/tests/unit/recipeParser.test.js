const fs = require('fs').promises;
const path = require('path');
const mockFs = require('mock-fs');

// Mock logger to prevent actual logging during tests
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock marked module - v4 uses function directly, not .parse
jest.mock('marked', () => {
  return jest.fn((content) => {
    // Simple markdown to HTML conversion for tests
    const lines = content.split('\n');
    let html = content;
    
    // Convert headers
    lines.forEach(line => {
      if (line.startsWith('# ')) {
        html = html.replace(line, `<h1>${line.substring(2)}</h1>`);
      } else if (line.startsWith('## ')) {
        html = html.replace(line, `<h2>${line.substring(3)}</h2>`);
      }
    });
    
    return html;
  });
});

const recipeParser = require('../../utils/recipeParser');

describe('Recipe Parser Utility', () => {
  afterEach(() => {
    mockFs.restore();
  });

  describe('generateSlug', () => {
    it('should generate URL-friendly slugs', () => {
      expect(recipeParser.generateSlug('Simple Recipe')).toBe('simple-recipe');
      expect(recipeParser.generateSlug('Recipe with Numbers 123')).toBe('recipe-with-numbers-123');
      expect(recipeParser.generateSlug('  Trimmed  Recipe  ')).toBe('trimmed-recipe');
    });

    it('should handle German umlauts', () => {
      expect(recipeParser.generateSlug('Käsekuchen')).toBe('kaesekuchen');
      expect(recipeParser.generateSlug('Brötchen mit Öl')).toBe('broetchen-mit-oel');
      expect(recipeParser.generateSlug('Süße Früchte')).toBe('suesse-fruechte');
      expect(recipeParser.generateSlug('Heißer Kaffee')).toBe('heisser-kaffee');
    });

    it('should handle special characters', () => {
      expect(recipeParser.generateSlug('Recipe @ Home!')).toBe('recipe-home');
      expect(recipeParser.generateSlug('50% Whole Wheat')).toBe('50-whole-wheat');
      expect(recipeParser.generateSlug('Recipe & More')).toBe('recipe-more');
    });
  });

  describe('parseRecipeFile', () => {
    beforeEach(() => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {
          'cakes': {
            'chocolate-cake.md': `---
title: Chocolate Cake
category: cakes
yield: 2 pieces
difficulty: medium
tags: 
  - chocolate
  - dessert
---

# Chocolate Cake

This is a delicious chocolate cake recipe.

## Ingredients
- 200g flour
- 100g cocoa
`
          }
        }
      });
    });

    it('should parse a recipe file correctly', async () => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      const filePath = path.join(recipesPath, 'cakes', 'chocolate-cake.md');
      const recipe = await recipeParser.parseRecipeFile(filePath);

      expect(recipe.slug).toBe('chocolate-cake');
      expect(recipe.category).toBe('cakes');
      expect(recipe.title).toBe('Chocolate Cake');
      expect(recipe.yield).toBe('2 pieces');
      expect(recipe.difficulty).toBe('medium');
      expect(recipe.tags).toEqual(['chocolate', 'dessert']);
      expect(recipe.content).toContain('This is a delicious chocolate cake recipe');
      expect(recipe.contentHtml).toContain('<h1>Chocolate Cake</h1>');
    });

    it('should handle files without frontmatter', async () => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {
          'simple.md': '# Simple Recipe\n\nJust content, no frontmatter.'
        }
      });

      const recipe = await recipeParser.parseRecipeFile(path.join(recipesPath, 'simple.md'));
      expect(recipe.slug).toBe('simple');
      expect(recipe.category).toBe('uncategorized');
      expect(recipe.content).toContain('Just content, no frontmatter');
    });
  });

  describe('getAllRecipes', () => {
    beforeEach(() => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {
          'cakes': {
            'cake1.md': `---
title: Cake 1
category: cakes
---
Content`,
            'cake2.md': `---
title: Cake 2
category: cakes
---
Content`
          },
          'breads': {
            'bread1.md': `---
title: Bread 1
category: breads
difficulty: easy
---
Content`
          },
          'templates': {
            'template.md': 'Should be ignored'
          },
          'root-recipe.md': `---
title: Root Recipe
---
Content`
        }
      });
    });

    it('should retrieve all recipes from subdirectories', async () => {
      const recipes = await recipeParser.getAllRecipes();

      expect(recipes).toHaveLength(4);
      expect(recipes.map(r => r.title).sort()).toEqual([
        'Bread 1',
        'Cake 1',
        'Cake 2',
        'Root Recipe'
      ]);
    });

    it('should return summary data only', async () => {
      const recipes = await recipeParser.getAllRecipes();
      const recipe = recipes[0];

      // Should have summary fields
      expect(recipe).toHaveProperty('slug');
      expect(recipe).toHaveProperty('title');
      expect(recipe).toHaveProperty('category');

      // Should not have full content
      expect(recipe).not.toHaveProperty('content');
      expect(recipe).not.toHaveProperty('contentHtml');
    });

    it('should ignore templates directory', async () => {
      const recipes = await recipeParser.getAllRecipes();
      const templateRecipe = recipes.find(r => r.slug === 'template');
      expect(templateRecipe).toBeUndefined();
    });
  });

  describe('getRecipeBySlug', () => {
    beforeEach(() => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {
          'cakes': {
            'chocolate-cake.md': `---
title: Chocolate Cake
---
Full recipe content`
          },
          'breads': {
            'sourdough.md': `---
title: Sourdough Bread
---
Bread content`
          }
        }
      });
    });

    it('should find and return a recipe by slug', async () => {
      const recipe = await recipeParser.getRecipeBySlug('chocolate-cake');

      expect(recipe).not.toBeNull();
      expect(recipe.title).toBe('Chocolate Cake');
      expect(recipe.content).toContain('Full recipe content');
    });

    it('should search across all categories', async () => {
      const cake = await recipeParser.getRecipeBySlug('chocolate-cake');
      const bread = await recipeParser.getRecipeBySlug('sourdough');

      expect(cake.category).toBe('cakes');
      expect(bread.category).toBe('breads');
    });

    it('should return null for non-existent recipe', async () => {
      const recipe = await recipeParser.getRecipeBySlug('non-existent');
      expect(recipe).toBeNull();
    });
  });

  describe('createRecipe', () => {
    beforeEach(() => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {}
      });
    });

    it('should create a new recipe file', async () => {
      const recipeData = {
        title: 'New Recipe',
        content: 'Recipe instructions here',
        category: 'cakes',
        yield: '4 servings'
      };

      const result = await recipeParser.createRecipe(recipeData);

      expect(result.slug).toBe('new-recipe');
      expect(result.category).toBe('cakes');

      // Verify file was created
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      const filePath = path.join(recipesPath, 'cakes', 'new-recipe.md');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toContain('title: New Recipe');
      expect(fileContent).toContain('Recipe instructions here');
    });

    it('should auto-generate slug if not provided', async () => {
      const recipeData = {
        title: 'Recipe Without Slug',
        content: 'Content'
      };

      const result = await recipeParser.createRecipe(recipeData);
      expect(result.slug).toBe('recipe-without-slug');
    });

    it('should throw error if recipe already exists', async () => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {
          'existing-recipe.md': 'Existing content'
        }
      });

      const recipeData = {
        slug: 'existing-recipe',
        title: 'Existing Recipe',
        content: 'New content'
      };

      await expect(recipeParser.createRecipe(recipeData))
        .rejects.toThrow('Recipe with this slug already exists');
    });
  });

  describe('updateRecipe', () => {
    beforeEach(() => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {
          'cakes': {
            'chocolate-cake.md': `---
title: Chocolate Cake
category: cakes
created_at: 2024-01-01
---
Original content`
          }
        }
      });
    });

    it('should update an existing recipe', async () => {
      const updatedData = {
        title: 'Updated Chocolate Cake',
        content: 'Updated content',
        category: 'cakes'
      };

      const result = await recipeParser.updateRecipe('chocolate-cake', updatedData);

      expect(result.title).toBe('Updated Chocolate Cake');

      // Verify file was updated
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      const filePath = path.join(recipesPath, 'cakes', 'chocolate-cake.md');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toContain('title: Updated Chocolate Cake');
      expect(fileContent).toContain('Updated content');
    });

    it('should move recipe to new category if changed', async () => {
      const updatedData = {
        title: 'Chocolate Cake',
        content: 'Content',
        category: 'desserts'
      };

      await recipeParser.updateRecipe('chocolate-cake', updatedData);

      // Old file should not exist
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      await expect(fs.access(path.join(recipesPath, 'cakes', 'chocolate-cake.md')))
        .rejects.toThrow();

      // New file should exist
      const newPath = path.join(recipesPath, 'desserts', 'chocolate-cake.md');
      await expect(fs.access(newPath)).resolves.toBeUndefined();
    });

    it('should return null for non-existent recipe', async () => {
      const result = await recipeParser.updateRecipe('non-existent', {});
      expect(result).toBeNull();
    });
  });

  describe('deleteRecipe', () => {
    beforeEach(() => {
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      mockFs({
        [recipesPath]: {
          'cakes': {
            'chocolate-cake.md': 'Recipe content'
          }
        }
      });
    });

    it('should delete an existing recipe', async () => {
      const result = await recipeParser.deleteRecipe('chocolate-cake');

      expect(result).toBe(true);

      // Verify file was deleted
      const recipesPath = path.join(__dirname, '../../../content/recipes');
      await expect(fs.access(path.join(recipesPath, 'cakes', 'chocolate-cake.md')))
        .rejects.toThrow();
    });

    it('should return false for non-existent recipe', async () => {
      const result = await recipeParser.deleteRecipe('non-existent');
      expect(result).toBe(false);
    });
  });
});