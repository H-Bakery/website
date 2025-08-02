const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const marked = require('marked');
const logger = require('./logger');

// Base path for recipes
const RECIPES_DIR = path.join(__dirname, '../../content/recipes');

// Generate a URL-friendly slug from a title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[äöüß]/g, (char) => {
      const replacements = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return replacements[char] || char;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Get the file path for a recipe slug
const getRecipePath = (slug, category = null) => {
  if (category) {
    return path.join(RECIPES_DIR, category, `${slug}.md`);
  }
  // If no category specified, we'll need to search for the file
  return null;
};

// Find a recipe file by slug (searches all subdirectories)
const findRecipeFile = async (slug) => {
  try {
    const categories = await fs.readdir(RECIPES_DIR, { withFileTypes: true });
    
    for (const category of categories) {
      if (category.isDirectory() && category.name !== 'templates') {
        const categoryPath = path.join(RECIPES_DIR, category.name);
        const files = await fs.readdir(categoryPath);
        
        for (const file of files) {
          if (file === `${slug}.md`) {
            return path.join(categoryPath, file);
          }
        }
      }
    }
    
    // Also check root directory
    const rootFiles = await fs.readdir(RECIPES_DIR);
    for (const file of rootFiles) {
      if (file === `${slug}.md`) {
        return path.join(RECIPES_DIR, file);
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error finding recipe file:', error);
    return null;
  }
};

// Parse a markdown recipe file
const parseRecipeFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data: frontmatter, content: markdownContent } = matter(content);
    
    // Extract category from file path
    const relativePath = path.relative(RECIPES_DIR, filePath);
    const pathParts = relativePath.split(path.sep);
    const category = pathParts.length > 1 ? pathParts[0] : 'uncategorized';
    
    // Extract slug from filename
    const filename = path.basename(filePath, '.md');
    const slug = filename;
    
    // Convert markdown to HTML
    const htmlContent = marked(markdownContent);
    
    return {
      slug,
      category,
      ...frontmatter,
      content: markdownContent,
      contentHtml: htmlContent,
      filePath: relativePath
    };
  } catch (error) {
    logger.error('Error parsing recipe file:', error);
    throw error;
  }
};

// Get all recipes with summary information
const getAllRecipes = async () => {
  try {
    const recipes = [];
    
    // Read all directories in the recipes folder
    const items = await fs.readdir(RECIPES_DIR, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory() && item.name !== 'templates') {
        const categoryPath = path.join(RECIPES_DIR, item.name);
        const files = await fs.readdir(categoryPath);
        
        for (const file of files) {
          if (file.endsWith('.md')) {
            const filePath = path.join(categoryPath, file);
            const recipe = await parseRecipeFile(filePath);
            
            // Return summary data only
            recipes.push({
              slug: recipe.slug,
              title: recipe.title || recipe.slug,
              category: recipe.category,
              yield: recipe.yield,
              difficulty: recipe.difficulty,
              tags: recipe.tags || [],
              preparationTime: recipe.preparation_time,
              bakingTime: recipe.baking?.time
            });
          }
        }
      } else if (item.isFile() && item.name.endsWith('.md')) {
        // Handle recipes in root directory
        const filePath = path.join(RECIPES_DIR, item.name);
        const recipe = await parseRecipeFile(filePath);
        
        recipes.push({
          slug: recipe.slug,
          title: recipe.title || recipe.slug,
          category: 'uncategorized',
          yield: recipe.yield,
          difficulty: recipe.difficulty,
          tags: recipe.tags || [],
          preparationTime: recipe.preparation_time,
          bakingTime: recipe.baking?.time
        });
      }
    }
    
    return recipes;
  } catch (error) {
    logger.error('Error getting all recipes:', error);
    throw error;
  }
};

// Get a single recipe by slug
const getRecipeBySlug = async (slug) => {
  try {
    const filePath = await findRecipeFile(slug);
    
    if (!filePath) {
      return null;
    }
    
    return await parseRecipeFile(filePath);
  } catch (error) {
    logger.error('Error getting recipe by slug:', error);
    throw error;
  }
};

// Format recipe data as markdown with frontmatter
const formatRecipeAsMarkdown = (recipeData) => {
  const frontmatter = { ...recipeData };
  
  // Remove content fields from frontmatter
  delete frontmatter.content;
  delete frontmatter.contentHtml;
  delete frontmatter.slug;
  delete frontmatter.category;
  delete frontmatter.filePath;
  
  // Create markdown string
  const yamlContent = matter.stringify(recipeData.content || '', frontmatter);
  
  return yamlContent;
};

// Create a new recipe
const createRecipe = async (recipeData) => {
  try {
    const slug = recipeData.slug || generateSlug(recipeData.title);
    const category = recipeData.category || 'uncategorized';
    
    // Ensure category directory exists
    const categoryPath = path.join(RECIPES_DIR, category);
    await fs.mkdir(categoryPath, { recursive: true });
    
    // Check if recipe already exists
    const existingPath = await findRecipeFile(slug);
    if (existingPath) {
      throw new Error('Recipe with this slug already exists');
    }
    
    // Format and save the recipe
    const markdown = formatRecipeAsMarkdown(recipeData);
    const filePath = path.join(categoryPath, `${slug}.md`);
    
    await fs.writeFile(filePath, markdown, 'utf-8');
    
    logger.info(`Created new recipe: ${slug}`);
    
    return { ...recipeData, slug, category };
  } catch (error) {
    logger.error('Error creating recipe:', error);
    throw error;
  }
};

// Update an existing recipe
const updateRecipe = async (slug, recipeData) => {
  try {
    const existingPath = await findRecipeFile(slug);
    
    if (!existingPath) {
      return null;
    }
    
    // If category changed, we need to move the file
    const currentCategory = path.relative(RECIPES_DIR, path.dirname(existingPath));
    const newCategory = recipeData.category || currentCategory;
    
    let newPath = existingPath;
    
    if (currentCategory !== newCategory) {
      // Ensure new category directory exists
      const newCategoryPath = path.join(RECIPES_DIR, newCategory);
      await fs.mkdir(newCategoryPath, { recursive: true });
      
      // Define new path
      newPath = path.join(newCategoryPath, `${slug}.md`);
      
      // Move file
      await fs.rename(existingPath, newPath);
    }
    
    // Update the file content
    const markdown = formatRecipeAsMarkdown({ ...recipeData, slug });
    await fs.writeFile(newPath, markdown, 'utf-8');
    
    logger.info(`Updated recipe: ${slug}`);
    
    return { ...recipeData, slug, category: newCategory };
  } catch (error) {
    logger.error('Error updating recipe:', error);
    throw error;
  }
};

// Delete a recipe
const deleteRecipe = async (slug) => {
  try {
    const filePath = await findRecipeFile(slug);
    
    if (!filePath) {
      return false;
    }
    
    await fs.unlink(filePath);
    
    logger.info(`Deleted recipe: ${slug}`);
    
    return true;
  } catch (error) {
    logger.error('Error deleting recipe:', error);
    throw error;
  }
};

module.exports = {
  generateSlug,
  getAllRecipes,
  getRecipeBySlug,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  parseRecipeFile,
  findRecipeFile
};