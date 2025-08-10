/**
 * Product controller
 */

import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { 
  CreateProductInput, 
  UpdateProductInput, 
  ProductFilter,
  StockAdjustment 
} from '../models/product.model';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  /**
   * Get all products
   * @route GET /api/products
   */
  getAllProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const filter: ProductFilter = {
        category: req.query.category as string,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        search: req.query.search as string
      };

      const products = await this.productService.getAllProducts(filter);

      res.json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch products'
      });
    }
  };

  /**
   * Get active products
   * @route GET /api/products/active
   */
  getActiveProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const products = await this.productService.getActiveProducts();

      res.json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (error) {
      console.error('Error fetching active products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active products'
      });
    }
  };

  /**
   * Get product by ID
   * @route GET /api/products/:id
   */
  getProductById = async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = parseInt(req.params['id']);
      const product = await this.productService.getProductById(productId);

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Product not found'
        });
        return;
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch product'
      });
    }
  };

  /**
   * Create new product
   * @route POST /api/products
   */
  createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const input: CreateProductInput = req.body;

      // Basic validation
      if (!input.name || !input.price) {
        res.status(400).json({
          success: false,
          error: 'Name and price are required'
        });
        return;
      }

      const product = await this.productService.createProduct(input);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      console.error('Error creating product:', error);
      
      if (error instanceof Error && error.message.includes('required')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create product'
      });
    }
  };

  /**
   * Update product
   * @route PUT /api/products/:id
   */
  updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = parseInt(req.params['id']);
      const input: UpdateProductInput = req.body;

      const product = await this.productService.updateProduct(productId, input);

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      console.error('Error updating product:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }

      if (error instanceof Error && error.message.includes('negative')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update product'
      });
    }
  };

  /**
   * Delete product
   * @route DELETE /api/products/:id
   */
  deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = parseInt(req.params['id']);
      await this.productService.deleteProduct(productId);

      res.json({
        success: true,
        message: 'Product deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete product'
      });
    }
  };

  /**
   * Adjust product stock
   * @route PATCH /api/products/:id/stock
   */
  adjustStock = async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = parseInt(req.params['id']);
      const { quantity, type, reason } = req.body;

      if (!quantity || !type) {
        res.status(400).json({
          success: false,
          error: 'Quantity and type are required'
        });
        return;
      }

      if (!['add', 'subtract', 'set'].includes(type)) {
        res.status(400).json({
          success: false,
          error: 'Type must be add, subtract, or set'
        });
        return;
      }

      const adjustment: StockAdjustment = {
        productId,
        quantity,
        type,
        reason
      };

      const product = await this.productService.adjustStock(adjustment);

      res.json({
        success: true,
        message: 'Stock adjusted successfully',
        data: product
      });
    } catch (error) {
      console.error('Error adjusting stock:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }

      if (error instanceof Error && 
          (error.message.includes('Insufficient') || error.message.includes('negative'))) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to adjust stock'
      });
    }
  };

  /**
   * Get products by category
   * @route GET /api/products/category/:category
   */
  getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = req.params['category'];
      const products = await this.productService.getProductsByCategory(category);

      res.json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (error) {
      console.error('Error fetching products by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch products'
      });
    }
  };

  /**
   * Get product categories
   * @route GET /api/products/categories
   */
  getCategories = async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = await this.productService.getCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch categories'
      });
    }
  };

  /**
   * Get low stock products
   * @route GET /api/products/low-stock
   */
  getLowStockProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 10;
      const products = await this.productService.getLowStockProducts(threshold);

      res.json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch low stock products'
      });
    }
  };

  /**
   * Get product with stats
   * @route GET /api/products/:id/stats
   */
  getProductWithStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = parseInt(req.params['id']);
      const product = await this.productService.getProductWithStats(productId);

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Product not found'
        });
        return;
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Error fetching product stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch product stats'
      });
    }
  };
}

// Export singleton instance
export const productController = new ProductController();