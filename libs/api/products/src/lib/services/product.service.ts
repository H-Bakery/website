/**
 * Product service
 */

import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilter,
  StockAdjustment,
  ProductWithStats
} from '../models/product.model';

export class ProductService {
  private products: Map<number, Product> = new Map();
  private nextId = 1;

  constructor() {
    // Initialize with some sample products
    this.seedProducts();
  }

  /**
   * Get all products with optional filters
   */
  async getAllProducts(filter?: ProductFilter): Promise<Product[]> {
    let products = Array.from(this.products.values());

    if (filter) {
      if (filter.isActive !== undefined) {
        products = products.filter(p => p.isActive === filter.isActive);
      }

      if (filter.category) {
        products = products.filter(p => 
          p.category?.toLowerCase() === filter.category?.toLowerCase()
        );
      }

      if (filter.minPrice !== undefined) {
        products = products.filter(p => p.price >= filter.minPrice!);
      }

      if (filter.maxPrice !== undefined) {
        products = products.filter(p => p.price <= filter.maxPrice!);
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        products = products.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
        );
      }
    }

    return products;
  }

  /**
   * Get active products only
   */
  async getActiveProducts(): Promise<Product[]> {
    return this.getAllProducts({ isActive: true });
  }

  /**
   * Get product by ID
   */
  async getProductById(id: number): Promise<Product | null> {
    return this.products.get(id) || null;
  }

  /**
   * Create new product
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    // Validate input
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Product name is required');
    }

    if (input.price < 0) {
      throw new Error('Price cannot be negative');
    }

    const product: Product = {
      id: this.nextId++,
      name: input.name,
      price: input.price,
      stock: input.stock || 0,
      dailyTarget: input.dailyTarget || 0,
      description: input.description,
      isActive: true,
      image: input.image,
      category: input.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.products.set(product.id, product);
    return product;
  }

  /**
   * Update product
   */
  async updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
    const product = this.products.get(id);
    if (!product) {
      throw new Error('Product not found');
    }

    // Validate price if provided
    if (input.price !== undefined && input.price < 0) {
      throw new Error('Price cannot be negative');
    }

    // Update fields
    if (input.name !== undefined) product.name = input.name;
    if (input.price !== undefined) product.price = input.price;
    if (input.stock !== undefined) product.stock = input.stock;
    if (input.dailyTarget !== undefined) product.dailyTarget = input.dailyTarget;
    if (input.description !== undefined) product.description = input.description;
    if (input.isActive !== undefined) product.isActive = input.isActive;
    if (input.image !== undefined) product.image = input.image;
    if (input.category !== undefined) product.category = input.category;

    product.updatedAt = new Date().toISOString();

    return product;
  }

  /**
   * Delete product (soft delete by deactivating)
   */
  async deleteProduct(id: number): Promise<void> {
    const product = this.products.get(id);
    if (!product) {
      throw new Error('Product not found');
    }

    product.isActive = false;
    product.updatedAt = new Date().toISOString();
  }

  /**
   * Adjust product stock
   */
  async adjustStock(adjustment: StockAdjustment): Promise<Product> {
    const product = this.products.get(adjustment.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    switch (adjustment.type) {
      case 'add':
        product.stock += adjustment.quantity;
        break;
      case 'subtract':
        if (product.stock < adjustment.quantity) {
          throw new Error('Insufficient stock');
        }
        product.stock -= adjustment.quantity;
        break;
      case 'set':
        if (adjustment.quantity < 0) {
          throw new Error('Stock cannot be negative');
        }
        product.stock = adjustment.quantity;
        break;
    }

    product.updatedAt = new Date().toISOString();
    return product;
  }

  /**
   * Check if product has sufficient stock
   */
  async checkStock(productId: number, quantity: number): Promise<boolean> {
    const product = this.products.get(productId);
    if (!product || !product.isActive) {
      return false;
    }
    return product.stock >= quantity;
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string): Promise<Product[]> {
    return this.getAllProducts({ category, isActive: true });
  }

  /**
   * Get product categories
   */
  async getCategories(): Promise<string[]> {
    const categories = new Set<string>();
    
    for (const product of this.products.values()) {
      if (product.category && product.isActive) {
        categories.add(product.category);
      }
    }
    
    return Array.from(categories).sort();
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(p => p.isActive && p.stock < threshold)
      .sort((a, b) => a.stock - b.stock);
  }

  /**
   * Get product with stats (placeholder for analytics)
   */
  async getProductWithStats(id: number): Promise<ProductWithStats | null> {
    const product = this.products.get(id);
    if (!product) {
      return null;
    }

    // In a real implementation, these would be calculated from order data
    return {
      ...product,
      totalSold: Math.floor(Math.random() * 1000),
      totalRevenue: Math.floor(Math.random() * 10000),
      averageDailySales: Math.floor(Math.random() * 50)
    };
  }

  /**
   * Seed initial products
   */
  private seedProducts(): void {
    const sampleProducts: CreateProductInput[] = [
      // Breads
      { name: 'Sauerteigbrot', price: 3.50, stock: 50, dailyTarget: 30, category: 'Brot', description: 'Traditionelles Sauerteigbrot' },
      { name: 'Vollkornbrot', price: 3.20, stock: 40, dailyTarget: 25, category: 'Brot', description: 'Gesundes Vollkornbrot' },
      { name: 'Baguette', price: 2.50, stock: 60, dailyTarget: 40, category: 'Brot', description: 'Französisches Baguette' },
      { name: 'Ciabatta', price: 3.00, stock: 30, dailyTarget: 20, category: 'Brot', description: 'Italienisches Ciabatta' },
      
      // Pastries
      { name: 'Croissant', price: 2.20, stock: 80, dailyTarget: 50, category: 'Gebäck', description: 'Buttercroissant' },
      { name: 'Brezel', price: 1.50, stock: 100, dailyTarget: 70, category: 'Gebäck', description: 'Laugenbrezel' },
      { name: 'Apfelstrudel', price: 3.80, stock: 20, dailyTarget: 15, category: 'Gebäck', description: 'Hausgemachter Apfelstrudel' },
      
      // Cakes
      { name: 'Schwarzwälder Kirschtorte', price: 25.00, stock: 5, dailyTarget: 3, category: 'Kuchen', description: 'Traditionelle Schwarzwälder Kirschtorte' },
      { name: 'Käsekuchen', price: 18.00, stock: 8, dailyTarget: 5, category: 'Kuchen', description: 'Cremiger Käsekuchen' },
      { name: 'Apfelkuchen', price: 15.00, stock: 10, dailyTarget: 7, category: 'Kuchen', description: 'Hausgemachter Apfelkuchen' }
    ];

    for (const productInput of sampleProducts) {
      this.createProduct(productInput);
    }
  }
}