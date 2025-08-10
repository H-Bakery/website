import { apiClient } from '../api-client';

export interface InventoryItem {
  id: number;
  productId: number;
  quantity: number;
  minimumQuantity: number;
  maximumQuantity?: number;
  reorderPoint?: number;
  location?: string;
  unit?: string;
  category?: string;
  supplier?: string;
  supplierContact?: string;
  lastRestocked?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  product?: {
    id: number;
    name: string;
    price: number;
    category?: string;
    description?: string;
  };
  adjustments?: StockAdjustment[];
}

export interface StockAdjustment {
  id: number;
  inventoryId: number;
  adjustmentType: 'increase' | 'decrease' | 'set';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  performedBy?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  user?: {
    id: number;
    name: string;
  };
}

export interface InventoryFilters {
  category?: string;
  lowStock?: boolean;
  search?: string;
  supplier?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateInventoryDto {
  productId: number;
  quantity?: number;
  minimumQuantity: number;
  maximumQuantity?: number;
  reorderPoint?: number;
  location?: string;
  unit?: string;
  category?: string;
  supplier?: string;
  supplierContact?: string;
  notes?: string;
}

export interface UpdateInventoryDto {
  minimumQuantity?: number;
  maximumQuantity?: number;
  reorderPoint?: number;
  location?: string;
  unit?: string;
  category?: string;
  supplier?: string;
  supplierContact?: string;
  notes?: string;
}

export interface StockAdjustmentDto {
  adjustmentType: 'increase' | 'decrease' | 'set';
  quantity: number;
  reason: string;
  notes?: string;
}

class InventoryService {
  private basePath = '/inventory';

  async getAll(
    filters: InventoryFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<InventoryItem>> {
    const params = new URLSearchParams();
    
    // Add filters
    if (filters.category) params.append('category', filters.category);
    if (filters.lowStock !== undefined) params.append('lowStock', filters.lowStock.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.supplier) params.append('supplier', filters.supplier);
    
    // Add pagination
    if (pagination.page) params.append('page', pagination.page.toString());
    if (pagination.limit) params.append('limit', pagination.limit.toString());
    if (pagination.sortBy) params.append('sortBy', pagination.sortBy);
    if (pagination.sortOrder) params.append('sortOrder', pagination.sortOrder);

    const response = await apiClient.get<PaginatedResponse<InventoryItem>>(
      `${this.basePath}?${params.toString()}`
    );
    return response.data as PaginatedResponse<InventoryItem>;
  }

  async getById(id: number): Promise<InventoryItem> {
    const response = await apiClient.get<InventoryItem>(`${this.basePath}/${id}`);
    return response.data as InventoryItem;
  }

  async create(data: CreateInventoryDto): Promise<InventoryItem> {
    const response = await apiClient.post<InventoryItem>(this.basePath, data);
    return response.data as InventoryItem;
  }

  async update(id: number, data: UpdateInventoryDto): Promise<InventoryItem> {
    const response = await apiClient.put<InventoryItem>(`${this.basePath}/${id}`, data);
    return response.data as InventoryItem;
  }

  async delete(id: number): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`${this.basePath}/${id}`);
    return response.data as { message: string };
  }

  async adjustStock(id: number, data: StockAdjustmentDto): Promise<InventoryItem> {
    const response = await apiClient.post<InventoryItem>(`${this.basePath}/${id}/adjust`, data);
    return response.data as InventoryItem;
  }

  async getLowStock(): Promise<InventoryItem[]> {
    const response = await apiClient.get<InventoryItem[]>(`${this.basePath}/low-stock`);
    return response.data as InventoryItem[];
  }

  async getCategories(): Promise<string[]> {
    const response = await apiClient.get<string[]>(`${this.basePath}/categories`);
    return response.data as string[];
  }

  async getSuppliers(): Promise<string[]> {
    const response = await apiClient.get<string[]>(`${this.basePath}/suppliers`);
    return response.data as string[];
  }
}

export const inventoryService = new InventoryService();