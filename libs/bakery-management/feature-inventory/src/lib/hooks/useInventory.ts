import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  inventoryService, 
  InventoryItem, 
  InventoryFilters, 
  PaginationOptions,
  CreateInventoryDto,
  UpdateInventoryDto,
  StockAdjustmentDto
} from '@bakery/shared/data-access';

// Query keys
export const inventoryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (filters: InventoryFilters, pagination: PaginationOptions) => 
    [...inventoryKeys.lists(), filters, pagination] as const,
  details: () => [...inventoryKeys.all, 'detail'] as const,
  detail: (id: number) => [...inventoryKeys.details(), id] as const,
  lowStock: () => [...inventoryKeys.all, 'low-stock'] as const,
  categories: () => [...inventoryKeys.all, 'categories'] as const,
  suppliers: () => [...inventoryKeys.all, 'suppliers'] as const,
};

// Get all inventory items with filters and pagination
export function useInventory(
  filters: InventoryFilters = {},
  pagination: PaginationOptions = {}
) {
  return useQuery(
    inventoryKeys.list(filters, pagination),
    () => inventoryService.getAll(filters, pagination),
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
    }
  );
}

// Get single inventory item
export function useInventoryItem(id: number | null) {
  return useQuery(
    inventoryKeys.detail(id!),
    () => inventoryService.getById(id!),
    {
      enabled: !!id,
      staleTime: 30000,
    }
  );
}

// Get low stock items
export function useLowStockItems() {
  return useQuery(
    inventoryKeys.lowStock(),
    () => inventoryService.getLowStock(),
    {
      staleTime: 60000, // 1 minute
      refetchInterval: 300000, // 5 minutes
    }
  );
}

// Get categories
export function useInventoryCategories() {
  return useQuery(
    inventoryKeys.categories(),
    () => inventoryService.getCategories(),
    {
      staleTime: 300000, // 5 minutes
    }
  );
}

// Get suppliers
export function useInventorySuppliers() {
  return useQuery(
    inventoryKeys.suppliers(),
    () => inventoryService.getSuppliers(),
    {
      staleTime: 300000, // 5 minutes
    }
  );
}

// Create inventory item
export function useCreateInventory() {
  const queryClient = useQueryClient();

  return useMutation(
    (data: CreateInventoryDto) => inventoryService.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(inventoryKeys.lists());
        queryClient.invalidateQueries(inventoryKeys.categories());
        queryClient.invalidateQueries(inventoryKeys.suppliers());
      },
    }
  );
}

// Update inventory item
export function useUpdateInventory() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ id, data }: { id: number; data: UpdateInventoryDto }) => 
      inventoryService.update(id, data),
    {
      onSuccess: (updatedItem) => {
        queryClient.invalidateQueries(inventoryKeys.lists());
        queryClient.setQueryData(
          inventoryKeys.detail(updatedItem.id),
          updatedItem
        );
      },
    }
  );
}

// Delete inventory item
export function useDeleteInventory() {
  const queryClient = useQueryClient();

  return useMutation(
    (id: number) => inventoryService.delete(id),
    {
      onSuccess: (_, id) => {
        queryClient.invalidateQueries(inventoryKeys.lists());
        queryClient.removeQueries(inventoryKeys.detail(id));
      },
    }
  );
}

// Adjust stock
export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ id, data }: { id: number; data: StockAdjustmentDto }) => 
      inventoryService.adjustStock(id, data),
    {
      onSuccess: (updatedItem) => {
        queryClient.invalidateQueries(inventoryKeys.lists());
        queryClient.invalidateQueries(inventoryKeys.lowStock());
        queryClient.setQueryData(
          inventoryKeys.detail(updatedItem.id),
          updatedItem
        );
      },
    }
  );
}

// Prefetch inventory item
export function usePrefetchInventory() {
  const queryClient = useQueryClient();

  return (id: number) => {
    queryClient.prefetchQuery(
      inventoryKeys.detail(id),
      () => inventoryService.getById(id),
      {
        staleTime: 30000,
      }
    );
  };
}