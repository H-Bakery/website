'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add email field
    await queryInterface.addColumn('Users', 'email', {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true, // Temporarily allow null for existing records
    });

    // Add firstName field
    await queryInterface.addColumn('Users', 'firstName', {
      type: Sequelize.STRING,
      allowNull: true, // Temporarily allow null for existing records
    });

    // Add lastName field
    await queryInterface.addColumn('Users', 'lastName', {
      type: Sequelize.STRING,
      allowNull: true, // Temporarily allow null for existing records
    });

    // Add role field
    await queryInterface.addColumn('Users', 'role', {
      type: Sequelize.ENUM('admin', 'staff', 'user'),
      defaultValue: 'user',
      allowNull: false,
    });

    // Add isActive field
    await queryInterface.addColumn('Users', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });

    // Add lastLogin field
    await queryInterface.addColumn('Users', 'lastLogin', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Update existing users with default values
    await queryInterface.sequelize.query(
      `UPDATE Users SET 
        email = username || '@bakery.local',
        firstName = username,
        lastName = 'User'
      WHERE email IS NULL`
    );

    // Now make email, firstName, and lastName non-nullable
    await queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    });

    await queryInterface.changeColumn('Users', 'firstName', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn('Users', 'lastName', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns in reverse order
    await queryInterface.removeColumn('Users', 'lastLogin');
    await queryInterface.removeColumn('Users', 'isActive');
    await queryInterface.removeColumn('Users', 'role');
    await queryInterface.removeColumn('Users', 'lastName');
    await queryInterface.removeColumn('Users', 'firstName');
    await queryInterface.removeColumn('Users', 'email');
  }
};