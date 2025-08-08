import { Op, FindAndCountOptions, Sequelize } from 'sequelize';
import {
  UnsoldProduct,
  CreateUnsoldProductInput,
  UpdateUnsoldProductInput,
  UnsoldProductFilters,
  UnsoldProductSummary,
  DailyWasteReport,
  WasteAnalysis,
  UNSOLD_PRODUCT_ERROR_MESSAGES,
  isValidDate,
  isFutureDate
} from '../models/unsold-product.model';
// Temporary local logger until utils is fixed
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) => console.log(`[DB] ${message}`, ...args)
};

export class UnsoldProductService {
  private UnsoldProduct: any;
  private Product: any;
  private User: any;

  constructor(models: {
    UnsoldProduct: any;
    Product: any;
    User: any;
  }) {
    this.UnsoldProduct = models.UnsoldProduct;
    this.Product = models.Product;
    this.User = models.User;
  }

  /**
   * Add unsold product entry
   */
  async addUnsoldProduct(
    data: CreateUnsoldProductInput,
    userId: number
  ): Promise<UnsoldProduct | null> {
    logger.info('Processing add unsold product request...');
    logger.info('Request data:', { ...data, userId });

    const { productId, quantity, date, reason, notes } = data;

    // Use current date if not provided
    const entryDate = date || new Date().toISOString().split('T')[0];

    // Validate date
    if (!isValidDate(entryDate)) {
      throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE);
    }

    if (isFutureDate(entryDate)) {
      throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.FUTURE_DATE_NOT_ALLOWED);
    }

    // Check if product exists
    const product = await this.Product.findByPk(productId);
    if (!product) {
      logger.warn(`Product not found: ${productId}`);
      throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    // Create unsold product entry
    const createData = {
      quantity,
      date: entryDate,
      ProductId: productId,
      UserId: userId,
      reason,
      notes
    };
    
    logger.info('Creating unsold product with data:', createData);
    const unsoldProduct = await this.UnsoldProduct.create(createData);

    logger.info(`Unsold product entry created: ${unsoldProduct.id}`);

    // Return with product info
    return this.getUnsoldProductById(unsoldProduct.id);
  }

  /**
   * Get unsold product by ID
   */
  async getUnsoldProductById(id: number): Promise<UnsoldProduct | null> {
    const unsoldProduct = await this.UnsoldProduct.findByPk(id, {
      include: [
        {
          model: this.Product,
          attributes: ['name', 'category']
        },
        {
          model: this.User,
          attributes: ['username']
        }
      ]
    });

    if (!unsoldProduct) {
      return null;
    }

    return this.transformToUnsoldProduct(unsoldProduct);
  }

  /**
   * Get unsold products history with filtering
   */
  async getUnsoldProducts(filters: UnsoldProductFilters): Promise<{
    items: UnsoldProduct[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    logger.info('Processing get unsold products request...');

    const {
      startDate,
      endDate,
      productId,
      category,
      userId,
      page = 1,
      limit = 20
    } = filters;

    const offset = (page - 1) * limit;
    const whereClause: any = {};

    // Date range filter
    if (startDate && endDate) {
      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE);
      }
      if (new Date(startDate) > new Date(endDate)) {
        throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE_RANGE);
      }
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      if (!isValidDate(startDate)) {
        throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE);
      }
      whereClause.date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      if (!isValidDate(endDate)) {
        throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE);
      }
      whereClause.date = {
        [Op.lte]: endDate
      };
    }

    // Product filter
    if (productId) {
      whereClause.ProductId = productId;
    }

    // User filter
    if (userId) {
      whereClause.UserId = userId;
    }

    // Category filter (requires join)
    const includeOptions: any[] = [
      {
        model: this.Product,
        attributes: ['name', 'category'],
        where: category ? { category } : undefined
      },
      {
        model: this.User,
        attributes: ['username']
      }
    ];

    const options: FindAndCountOptions = {
      where: whereClause,
      include: includeOptions,
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset
    };

    const { count, rows } = await this.UnsoldProduct.findAndCountAll(options);

    logger.info(`Retrieved ${rows.length} unsold product entries`);

    const items = rows.map((row: any) => this.transformToUnsoldProduct(row));
    const totalPages = Math.ceil(count / limit);

    return {
      items,
      total: count,
      page,
      totalPages
    };
  }

  /**
   * Get unsold products summary (totals by product)
   */
  async getUnsoldProductsSummary(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<UnsoldProductSummary[]> {
    logger.info('Processing get unsold products summary request...');

    const whereClause: any = {};

    if (filters?.startDate && filters?.endDate) {
      whereClause.date = {
        [Op.between]: [filters.startDate, filters.endDate]
      };
    }

    const summary = await this.UnsoldProduct.findAll({
      attributes: [
        'ProductId',
        [Sequelize.fn('SUM', Sequelize.col('quantity')), 'totalUnsold']
      ],
      where: whereClause,
      include: [
        {
          model: this.Product,
          attributes: ['name', 'category']
        }
      ],
      group: ['ProductId', 'Product.id', 'Product.name', 'Product.category'],
      order: [[Sequelize.fn('SUM', Sequelize.col('quantity')), 'DESC']],
      raw: false
    });

    logger.info(`Retrieved summary for ${summary.length} products`);

    return summary.map((item: any) => ({
      productId: item.ProductId,
      totalUnsold: parseInt(item.dataValues.totalUnsold || item.get('totalUnsold')),
      product: {
        name: item.Product.name,
        category: item.Product.category
      }
    }));
  }

  /**
   * Get daily waste report
   */
  async getDailyWasteReport(date: string): Promise<DailyWasteReport> {
    if (!isValidDate(date)) {
      throw new Error(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE);
    }

    const entries = await this.UnsoldProduct.findAll({
      where: { date },
      include: [{
        model: this.Product,
        attributes: ['name', 'category']
      }]
    });

    const byCategory: Record<string, number> = {};
    const byProduct: Array<{ productId: number; productName: string; quantity: number }> = [];
    let totalQuantity = 0;

    entries.forEach((entry: any) => {
      const category = entry.Product.category;
      const quantity = entry.quantity;

      totalQuantity += quantity;

      // Aggregate by category
      if (!byCategory[category]) {
        byCategory[category] = 0;
      }
      byCategory[category] += quantity;

      // Add to product list
      byProduct.push({
        productId: entry.ProductId,
        productName: entry.Product.name,
        quantity
      });
    });

    return {
      date,
      totalItems: entries.length,
      totalQuantity,
      byCategory,
      byProduct: byProduct.sort((a, b) => b.quantity - a.quantity)
    };
  }

  /**
   * Update unsold product entry
   */
  async updateUnsoldProduct(
    id: number,
    data: UpdateUnsoldProductInput
  ): Promise<UnsoldProduct | null> {
    const unsoldProduct = await this.UnsoldProduct.findByPk(id);

    if (!unsoldProduct) {
      return null;
    }

    await unsoldProduct.update(data);

    return this.getUnsoldProductById(id);
  }

  /**
   * Delete unsold product entry
   */
  async deleteUnsoldProduct(id: number): Promise<boolean> {
    const unsoldProduct = await this.UnsoldProduct.findByPk(id);

    if (!unsoldProduct) {
      return false;
    }

    await unsoldProduct.destroy();
    return true;
  }

  /**
   * Transform database model to UnsoldProduct type
   */
  private transformToUnsoldProduct(model: any): UnsoldProduct {
    return {
      id: model.id,
      productId: model.ProductId,
      quantity: model.quantity,
      date: model.date,
      userId: model.UserId,
      reason: model.reason,
      notes: model.notes,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      product: model.Product ? {
        name: model.Product.name,
        category: model.Product.category
      } : undefined,
      user: model.User ? {
        username: model.User.username
      } : undefined
    };
  }
}