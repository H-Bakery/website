const { sequelize, Inventory } = require("../../models");
const { DataTypes } = require("sequelize");

describe("Inventory Model", () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Inventory.destroy({ where: {} });
  });

  describe("Model Definition", () => {
    it("should have correct table name", () => {
      expect(Inventory.tableName).toBe("Inventories");
    });

    it("should have all required fields", () => {
      const attributes = Inventory.rawAttributes;
      expect(attributes.id).toBeDefined();
      expect(attributes.name).toBeDefined();
      expect(attributes.sku).toBeDefined();
      expect(attributes.description).toBeDefined();
      expect(attributes.quantity).toBeDefined();
      expect(attributes.unit).toBeDefined();
      expect(attributes.lowStockThreshold).toBeDefined();
      expect(attributes.category).toBeDefined();
      expect(attributes.location).toBeDefined();
      expect(attributes.supplier).toBeDefined();
      expect(attributes.cost).toBeDefined();
      expect(attributes.reorderLevel).toBeDefined();
      expect(attributes.reorderQuantity).toBeDefined();
      expect(attributes.lastRestockedAt).toBeDefined();
      expect(attributes.expiryDate).toBeDefined();
      expect(attributes.notes).toBeDefined();
      expect(attributes.isActive).toBeDefined();
    });
  });

  describe("Field Validations", () => {
    it("should require a name", async () => {
      await expect(Inventory.create({})).rejects.toThrow();
      await expect(
        Inventory.create({ name: "", unit: "kg" })
      ).rejects.toThrow("Item name cannot be empty");
    });

    it("should enforce unique name constraint", async () => {
      await Inventory.create({ name: "Flour", unit: "kg" });
      await expect(
        Inventory.create({ name: "Flour", unit: "kg" })
      ).rejects.toThrow();
    });

    it("should enforce unique SKU constraint if provided", async () => {
      await Inventory.create({ name: "Flour", sku: "FL001", unit: "kg" });
      await expect(
        Inventory.create({ name: "Sugar", sku: "FL001", unit: "kg" })
      ).rejects.toThrow();
    });

    it("should not allow negative quantity", async () => {
      await expect(
        Inventory.create({ name: "Flour", quantity: -5, unit: "kg" })
      ).rejects.toThrow("Quantity cannot be negative");
    });

    it("should not allow negative lowStockThreshold", async () => {
      await expect(
        Inventory.create({ name: "Flour", lowStockThreshold: -10, unit: "kg" })
      ).rejects.toThrow("Low stock threshold cannot be negative");
    });

    it("should validate unit values", async () => {
      await expect(
        Inventory.create({ name: "Flour", unit: "invalid" })
      ).rejects.toThrow("Invalid unit type");

      const validUnits = ["kg", "g", "liters", "ml", "units", "pieces", "bags", "boxes", "bottles", "jars"];
      for (const unit of validUnits) {
        const item = await Inventory.create({ name: `Test ${unit}`, unit });
        expect(item.unit).toBe(unit);
      }
    });

    it("should validate category values", async () => {
      await expect(
        Inventory.create({ name: "Flour", unit: "kg", category: "invalid" })
      ).rejects.toThrow("Invalid category");

      const validCategories = ["ingredients", "packaging", "supplies", "equipment", "consumables", "other"];
      for (const category of validCategories) {
        const item = await Inventory.create({ 
          name: `Test ${category}`, 
          unit: "units", 
          category 
        });
        expect(item.category).toBe(category);
      }
    });

    it("should not allow negative cost", async () => {
      await expect(
        Inventory.create({ name: "Flour", unit: "kg", cost: -10 })
      ).rejects.toThrow("Cost cannot be negative");
    });

    it("should not allow negative reorderLevel", async () => {
      await expect(
        Inventory.create({ name: "Flour", unit: "kg", reorderLevel: -5 })
      ).rejects.toThrow("Reorder level cannot be negative");
    });

    it("should not allow negative reorderQuantity", async () => {
      await expect(
        Inventory.create({ name: "Flour", unit: "kg", reorderQuantity: -5 })
      ).rejects.toThrow("Reorder quantity cannot be negative");
    });
  });

  describe("Default Values", () => {
    it("should set default values correctly", async () => {
      const item = await Inventory.create({ name: "Test Item" });
      expect(item.quantity).toBe(0);
      expect(item.unit).toBe("units");
      expect(item.lowStockThreshold).toBe(0);
      expect(item.reorderLevel).toBe(0);
      expect(item.reorderQuantity).toBe(0);
      expect(item.isActive).toBe(true);
    });
  });

  describe("Instance Methods", () => {
    describe("isLowStock", () => {
      it("should return true when quantity is at or below threshold", async () => {
        const item = await Inventory.create({
          name: "Flour",
          unit: "kg",
          quantity: 5,
          lowStockThreshold: 10
        });
        expect(item.isLowStock()).toBe(true);

        item.quantity = 10;
        expect(item.isLowStock()).toBe(true);

        item.quantity = 11;
        expect(item.isLowStock()).toBe(false);
      });
    });

    describe("needsReorder", () => {
      it("should return true when quantity is at or below reorder level", async () => {
        const item = await Inventory.create({
          name: "Flour",
          unit: "kg",
          quantity: 15,
          reorderLevel: 20
        });
        expect(item.needsReorder()).toBe(true);

        item.quantity = 20;
        expect(item.needsReorder()).toBe(true);

        item.quantity = 21;
        expect(item.needsReorder()).toBe(false);
      });
    });

    describe("adjustStock", () => {
      it("should increase stock correctly", async () => {
        const item = await Inventory.create({
          name: "Flour",
          unit: "kg",
          quantity: 10
        });
        const originalDate = item.lastRestockedAt;

        await item.adjustStock(5);
        await item.reload();

        expect(item.quantity).toBe(15);
        expect(item.lastRestockedAt).not.toBe(originalDate);
      });

      it("should decrease stock correctly", async () => {
        const item = await Inventory.create({
          name: "Flour",
          unit: "kg",
          quantity: 10
        });

        await item.adjustStock(-3);
        await item.reload();

        expect(item.quantity).toBe(7);
      });

      it("should not allow stock to go negative", async () => {
        const item = await Inventory.create({
          name: "Flour",
          unit: "kg",
          quantity: 10
        });

        await expect(item.adjustStock(-15)).rejects.toThrow(
          "Insufficient stock. Available: 10, Requested: 15"
        );

        await item.reload();
        expect(item.quantity).toBe(10);
      });

      it("should handle decimal quantities", async () => {
        const item = await Inventory.create({
          name: "Flour",
          unit: "kg",
          quantity: 10.5
        });

        await item.adjustStock(2.3);
        await item.reload();
        expect(item.quantity).toBeCloseTo(12.8, 2);

        await item.adjustStock(-0.8);
        await item.reload();
        expect(item.quantity).toBeCloseTo(12.0, 2);
      });
    });
  });

  describe("Complex Scenarios", () => {
    it("should create a complete inventory item with all fields", async () => {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const item = await Inventory.create({
        name: "Premium Bread Flour",
        sku: "PBF-001",
        description: "High-quality bread flour for artisan breads",
        quantity: 50,
        unit: "kg",
        lowStockThreshold: 20,
        category: "ingredients",
        location: "Storage Room A, Shelf 3",
        supplier: "Miller's Best Co.",
        cost: 1.25,
        reorderLevel: 25,
        reorderQuantity: 100,
        lastRestockedAt: now,
        expiryDate: expiryDate,
        notes: "Keep in cool, dry place. Check for pests regularly.",
        isActive: true
      });

      expect(item.name).toBe("Premium Bread Flour");
      expect(item.sku).toBe("PBF-001");
      expect(item.quantity).toBe(50);
      expect(item.unit).toBe("kg");
      expect(item.category).toBe("ingredients");
      expect(item.cost).toBe(1.25);
      expect(item.isLowStock()).toBe(false);
      expect(item.needsReorder()).toBe(false);
    });

    it("should handle multiple items with different categories", async () => {
      const items = await Promise.all([
        Inventory.create({ name: "Flour", unit: "kg", category: "ingredients" }),
        Inventory.create({ name: "Bread Bags", unit: "pieces", category: "packaging" }),
        Inventory.create({ name: "Cleaning Supplies", unit: "units", category: "supplies" }),
        Inventory.create({ name: "Mixer", unit: "units", category: "equipment" }),
      ]);

      const counts = await Promise.all([
        Inventory.count({ where: { category: "ingredients" } }),
        Inventory.count({ where: { category: "packaging" } }),
        Inventory.count({ where: { category: "supplies" } }),
        Inventory.count({ where: { category: "equipment" } }),
      ]);

      expect(counts).toEqual([1, 1, 1, 1]);
    });
  });
});