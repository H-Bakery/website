module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define("Order", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customerPhone: {
      type: DataTypes.STRING,
    },
    customerEmail: {
      type: DataTypes.STRING,
    },
    pickupDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "Pending",
    },
    notes: {
      type: DataTypes.TEXT,
    },
    totalPrice: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  }, {
    timestamps: true,
    paranoid: true, // Enable soft deletes
  });

  Order.associate = (models) => {
    if (models.OrderItem) {
      Order.hasMany(models.OrderItem);
    }
  };

  return Order;
};
