const inventoryService = require("../../services/inventoryService");
const { Inventory } = require("../../models");
const logger = require("../../utils/logger");

// Mock the models and logger
jest.mock("../../models");
jest.mock("../../utils/logger");

describe("InventoryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock logger methods
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  describe("createItem", () => {
    it("should create a new inventory item", async () => {
      const mockItem = { id: 1, name: "Flour", unit: "kg", quantity: 50 };
      Inventory.create.mockResolvedValue(mockItem);

      const result = await inventoryService.createItem({ name: "Flour", unit: "kg" });

      expect(Inventory.create).toHaveBeenCalledWith({ name: "Flour", unit: "kg" });
      expect(result).toEqual(mockItem);
      expect(logger.info).toHaveBeenCalledWith("Creating new inventory item", { name: "Flour" });
    });

    it("should throw error when creation fails", async () => {
      const error = new Error("Database error");
      Inventory.create.mockRejectedValue(error);

      await expect(inventoryService.createItem({ name: "Flour" })).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith("Error creating inventory item:", error);
    });
  });

  describe("getAllItems", () => {
    it("should return all items without filters", async () => {
      const mockItems = [
        { id: 1, name: "Flour", category: "ingredients" },
        { id: 2, name: "Sugar", category: "ingredients" }
      ];
      Inventory.findAll.mockResolvedValue(mockItems);

      const result = await inventoryService.getAllItems();

      expect(Inventory.findAll).toHaveBeenCalledWith({
        where: {},
        order: [['name', 'ASC']]
      });
      expect(result).toEqual(mockItems);
    });

    it("should filter by category", async () => {
      const mockItems = [{ id: 1, name: "Flour", category: "ingredients" }];
      Inventory.findAll.mockResolvedValue(mockItems);

      const result = await inventoryService.getAllItems({ category: "ingredients" });

      expect(Inventory.findAll).toHaveBeenCalledWith({
        where: { category: "ingredients" },
        order: [['name', 'ASC']]
      });
      expect(result).toEqual(mockItems);
    });

    it("should filter by search term", async () => {
      const mockItems = [{ id: 1, name: "Flour" }];
      Inventory.findAll.mockResolvedValue(mockItems);
      
      // Mock Sequelize Op
      const { Op } = require("sequelize");

      await inventoryService.getAllItems({ search: "Flo" });

      expect(Inventory.findAll).toHaveBeenCalled();
      const callArgs = Inventory.findAll.mock.calls[0][0];
      expect(callArgs.where[Op.or]).toBeDefined();
    });

    it("should handle errors", async () => {
      const error = new Error("Database error");
      Inventory.findAll.mockRejectedValue(error);

      await expect(inventoryService.getAllItems()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith("Error retrieving inventory items:", error);
    });
  });

  describe("getItemById", () => {
    it("should return item when found", async () => {
      const mockItem = { id: 1, name: "Flour" };
      Inventory.findByPk.mockResolvedValue(mockItem);

      const result = await inventoryService.getItemById(1);

      expect(Inventory.findByPk).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockItem);
    });

    it("should return null when item not found", async () => {
      Inventory.findByPk.mockResolvedValue(null);

      const result = await inventoryService.getItemById(999);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Inventory item not found: 999");
    });

    it("should handle errors", async () => {
      const error = new Error("Database error");
      Inventory.findByPk.mockRejectedValue(error);

      await expect(inventoryService.getItemById(1)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith("Error retrieving inventory item 1:", error);
    });
  });

  describe("updateItemDetails", () => {
    it("should update item details excluding quantity", async () => {
      const mockItem = {
        id: 1,
        name: "Flour",
        update: jest.fn().mockResolvedValue(true)
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      const updateData = { name: "Premium Flour", quantity: 100, category: "ingredients" };
      const result = await inventoryService.updateItemDetails(1, updateData);

      expect(mockItem.update).toHaveBeenCalledWith({ 
        name: "Premium Flour", 
        category: "ingredients" 
      });
      expect(mockItem.update).not.toHaveBeenCalledWith(expect.objectContaining({ quantity: 100 }));
      expect(result).toEqual(mockItem);
    });

    it("should return null when item not found", async () => {
      Inventory.findByPk.mockResolvedValue(null);

      const result = await inventoryService.updateItemDetails(999, { name: "Test" });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Inventory item not found for update: 999");
    });

    it("should handle errors", async () => {
      const error = new Error("Update error");
      const mockItem = {
        update: jest.fn().mockRejectedValue(error)
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      await expect(inventoryService.updateItemDetails(1, { name: "Test" })).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith("Error updating inventory item 1:", error);
    });
  });

  describe("adjustStockLevel", () => {
    it("should increase stock successfully", async () => {
      const mockItem = {
        id: 1,
        quantity: 50,
        adjustStock: jest.fn().mockResolvedValue(true)
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      const result = await inventoryService.adjustStockLevel(1, 10, "Restocking");

      expect(mockItem.adjustStock).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockItem);
      expect(logger.info).toHaveBeenCalledWith(
        "Stock adjusted for item 1",
        expect.objectContaining({ oldQuantity: 50, change: 10 })
      );
    });

    it("should decrease stock successfully", async () => {
      const mockItem = {
        id: 1,
        quantity: 50,
        adjustStock: jest.fn().mockResolvedValue(true)
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      const result = await inventoryService.adjustStockLevel(1, -10, "Usage");

      expect(mockItem.adjustStock).toHaveBeenCalledWith(-10);
      expect(result).toEqual(mockItem);
    });

    it("should return null when item not found", async () => {
      Inventory.findByPk.mockResolvedValue(null);

      const result = await inventoryService.adjustStockLevel(999, 10);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Inventory item not found for stock adjustment: 999");
    });

    it("should handle insufficient stock error", async () => {
      const mockItem = {
        id: 1,
        quantity: 10,
        adjustStock: jest.fn().mockRejectedValue(
          new Error("Insufficient stock. Available: 10, Requested: 15")
        )
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      await expect(inventoryService.adjustStockLevel(1, -15)).rejects.toThrow();
    });

    it("should set INSUFFICIENT_STOCK code when stock would go negative", async () => {
      const mockItem = {
        id: 1,
        quantity: 10
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      try {
        await inventoryService.adjustStockLevel(1, -15);
      } catch (error) {
        expect(error.code).toBe('INSUFFICIENT_STOCK');
        expect(error.available).toBe(10);
        expect(error.requested).toBe(15);
      }
    });
  });

  describe("deleteItem", () => {
    it("should soft delete item successfully", async () => {
      const mockItem = {
        id: 1,
        update: jest.fn().mockResolvedValue(true)
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      const result = await inventoryService.deleteItem(1);

      expect(mockItem.update).toHaveBeenCalledWith({ isActive: false });
      expect(result).toBe(true);
    });

    it("should return false when item not found", async () => {
      Inventory.findByPk.mockResolvedValue(null);

      const result = await inventoryService.deleteItem(999);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("Inventory item not found for deletion: 999");
    });

    it("should handle errors", async () => {
      const error = new Error("Delete error");
      const mockItem = {
        update: jest.fn().mockRejectedValue(error)
      };
      Inventory.findByPk.mockResolvedValue(mockItem);

      await expect(inventoryService.deleteItem(1)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith("Error deleting inventory item 1:", error);
    });
  });

  describe("getItemsNeedingReorder", () => {
    it("should return items below reorder level", async () => {
      const mockItems = [
        { id: 1, name: "Flour", quantity: 5, reorderLevel: 10 },
        { id: 2, name: "Sugar", quantity: 3, reorderLevel: 20 }
      ];
      Inventory.findAll.mockResolvedValue(mockItems);
      Inventory.sequelize = { col: jest.fn(col => col) };

      const result = await inventoryService.getItemsNeedingReorder();

      expect(result).toEqual(mockItems);
      expect(Inventory.findAll).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const error = new Error("Database error");
      Inventory.findAll.mockRejectedValue(error);

      await expect(inventoryService.getItemsNeedingReorder()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith("Error retrieving items needing reorder:", error);
    });
  });

  describe("getLowStockItems", () => {
    it("should return items below low stock threshold", async () => {
      const mockItems = [
        { id: 1, name: "Flour", quantity: 5, lowStockThreshold: 10 }
      ];
      Inventory.findAll.mockResolvedValue(mockItems);
      Inventory.sequelize = { col: jest.fn(col => col) };

      const result = await inventoryService.getLowStockItems();

      expect(result).toEqual(mockItems);
      expect(Inventory.findAll).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const error = new Error("Database error");
      Inventory.findAll.mockRejectedValue(error);

      await expect(inventoryService.getLowStockItems()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith("Error retrieving low stock items:", error);
    });
  });

  describe("bulkAdjustStock", () => {
    it("should successfully adjust multiple items", async () => {
      // Mock adjustStockLevel method
      inventoryService.adjustStockLevel = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: "Flour", quantity: 45 })
        .mockResolvedValueOnce({ id: 2, name: "Sugar", quantity: 35 });

      const adjustments = [
        { id: 1, change: -5 },
        { id: 2, change: -15 }
      ];

      const result = await inventoryService.bulkAdjustStock(adjustments, "Production use");

      expect(inventoryService.adjustStockLevel).toHaveBeenCalledTimes(2);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle partial failures", async () => {
      inventoryService.adjustStockLevel = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: "Flour", quantity: 45 })
        .mockRejectedValueOnce(new Error("Insufficient stock"));

      const adjustments = [
        { id: 1, change: -5 },
        { id: 2, change: -50 }
      ];

      const result = await inventoryService.bulkAdjustStock(adjustments);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe("Insufficient stock");
    });

    it("should handle errors", async () => {
      const error = new Error("System error");
      inventoryService.adjustStockLevel = jest.fn().mockRejectedValue(error);

      const adjustments = [{ id: 1, change: -5 }];

      const result = await inventoryService.bulkAdjustStock(adjustments);
      
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
    });
  });
});