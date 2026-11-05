'use strict'

/**
 * Verkaufspartner (TASK-037).
 *
 * Vier Tabellen für den Backschrank beim CAP-Markt:
 *   Partners                 - der Verkaufspartner selbst
 *   PartnerDeliveryTemplates - Standard-Bestückung je Wochentag
 *   PartnerVisits            - ein Besuch am Backschrank
 *   PartnerVisitItems        - Rest und Neu je Produkt, mit Preis-Snapshot
 *
 * Verkaufszahlen werden nicht gespeichert, sondern aus den Besuchen berechnet
 * (siehe src/services/partner-stats.core.js).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Partners', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      street: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      zip: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      contactName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      // ISO-Wochentage, 1 = Montag … 7 = Sonntag. CAP-Markt: [2,3,4,5,6]
      deliveryDays: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      settlementModel: {
        type: Sequelize.ENUM('commission', 'firm_sale'),
        allowNull: false,
        defaultValue: 'commission',
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    await queryInterface.createTable('PartnerDeliveryTemplates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      partnerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Partners', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      weekday: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // [{ productId, productSlug, quantity }]
      items: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    // Genau eine Vorlage je Partner und Wochentag.
    await queryInterface.addIndex(
      'PartnerDeliveryTemplates',
      ['partnerId', 'weekday'],
      { unique: true, name: 'unique_partner_weekday_template' }
    )

    await queryInterface.createTable('PartnerVisits', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      partnerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Partners', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Geschäftstag - Gruppierungsschlüssel aller Auswertungen.
      businessDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      // Zeitpunkt, frei änderbar für die Nacherfassung im Büro.
      visitAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      visitType: {
        type: Sequelize.ENUM('initial', 'refill', 'pickup'),
        allowNull: false,
        defaultValue: 'refill',
      },
      // 1, 2, 3 … innerhalb des Geschäftstags.
      sequence: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      staffId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      staffName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    await queryInterface.addIndex('PartnerVisits', [
      'partnerId',
      'businessDate',
    ])
    await queryInterface.addIndex('PartnerVisits', ['businessDate'])

    await queryInterface.createTable('PartnerVisitItems', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      visitId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'PartnerVisits', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Numerische HQ-ID des Produkts.
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // HQ-`id`, stabil gegen Umnummerierung.
      productSlug: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // Snapshot: hält alte Abrechnungen korrekt, wenn sich der Name ändert.
      productName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // Snapshot des HQ-Preises zum Zeitpunkt des Besuchs.
      unitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      // Vorgefundener Rest. NULL = nicht gezählt (≠ 0 = Schrank war leer).
      countedQty: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      deliveredQty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    await queryInterface.addIndex('PartnerVisitItems', ['visitId'])
    await queryInterface.addIndex('PartnerVisitItems', ['productSlug'])
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('PartnerVisitItems')
    await queryInterface.dropTable('PartnerVisits')
    await queryInterface.dropTable('PartnerDeliveryTemplates')
    await queryInterface.dropTable('Partners')
  },
}
