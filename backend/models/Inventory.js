module.exports = (sequelize, DataTypes) => {
  const Inventory = sequelize.define("Inventory", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "Item name cannot be empty",
        },
      },
    },
    sku: {
      type: DataTypes.STRING,
      unique: true,
      validate: {
        notEmpty: {
          msg: "SKU cannot be empty if provided",
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
    },
    quantity: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "Quantity cannot be negative",
        },
      },
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "units",
      validate: {
        isIn: {
          args: [["kg", "g", "liters", "ml", "units", "pieces", "bags", "boxes", "bottles", "jars"]],
          msg: "Invalid unit type",
        },
      },
    },
    lowStockThreshold: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "Low stock threshold cannot be negative",
        },
      },
    },
    category: {
      type: DataTypes.STRING,
      validate: {
        isIn: {
          args: [["ingredients", "packaging", "supplies", "equipment", "consumables", "other"]],
          msg: "Invalid category",
        },
      },
    },
    location: {
      type: DataTypes.STRING,
      comment: "Storage location in the bakery",
    },
    supplier: {
      type: DataTypes.STRING,
    },
    cost: {
      type: DataTypes.FLOAT,
      validate: {
        min: {
          args: [0],
          msg: "Cost cannot be negative",
        },
      },
    },
    reorderLevel: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "Reorder level cannot be negative",
        },
      },
    },
    reorderQuantity: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "Reorder quantity cannot be negative",
        },
      },
    },
    lastRestockedAt: {
      type: DataTypes.DATE,
    },
    expiryDate: {
      type: DataTypes.DATE,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  });

  // Instance methods
  Inventory.prototype.isLowStock = function () {
    return this.quantity <= this.lowStockThreshold;
  };

  Inventory.prototype.needsReorder = function () {
    return this.quantity <= this.reorderLevel;
  };

  Inventory.prototype.adjustStock = async function (change) {
    const newQuantity = this.quantity + change;
    if (newQuantity < 0) {
      throw new Error(`Insufficient stock. Available: ${this.quantity}, Requested: ${Math.abs(change)}`);
    }
    this.quantity = newQuantity;
    if (change > 0) {
      this.lastRestockedAt = new Date();
    }
    await this.save();
    return this;
  };

  return Inventory;
};