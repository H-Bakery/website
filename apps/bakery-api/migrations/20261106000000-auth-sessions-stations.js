'use strict'

/**
 * B3 auth: sessions and stations (roadmap D5).
 *
 *   stations        a shared device (Laden-, Backstube-Tablet) registered by an
 *                   `inhaber`; only the SHA-256 of its long-lived token is stored
 *   auth_sessions   one login: `personal` (password, sliding 14 days) or
 *                   `station` (PIN at a station, hard end after 12 hours).
 *                   Every access token names its session (`sid`); logout,
 *                   refresh-token reuse, deactivation, a new password or a
 *                   revoked station end it at once.
 *   refresh_tokens  + `session_id`: every token of one rotation chain belongs
 *                   to the same session, so reuse of a rotated token revokes
 *                   the whole chain in one update.
 *
 * Idempotent like the baseline: tables are created only if missing, the
 * column only if absent.
 */

const TABLES = ['stations', 'auth_sessions']
const SESSION_KINDS = ['personal', 'station']

async function existingTables(queryInterface) {
  const tables = await queryInterface.showAllTables()
  return new Set(
    tables.map((t) =>
      String(typeof t === 'string' ? t : t.tableName).toLowerCase()
    )
  )
}

module.exports = {
  TABLES,
  SESSION_KINDS,

  up: async (queryInterface, Sequelize) => {
    const tables = await existingTables(queryInterface)

    if (!tables.has('stations')) {
      await queryInterface.createTable('stations', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        name: { type: Sequelize.STRING(80), allowNull: false },
        token_hash: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true,
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        last_used_at: { type: Sequelize.DATE, allowNull: true },
        revoked_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      })
    }

    if (!tables.has('auth_sessions')) {
      await queryInterface.createTable('auth_sessions', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        kind: { type: Sequelize.ENUM(...SESSION_KINDS), allowNull: false },
        station_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'stations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        revoked_at: { type: Sequelize.DATE, allowNull: true },
        revoke_reason: { type: Sequelize.STRING(32), allowNull: true },
        user_agent: { type: Sequelize.STRING, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      })
      await queryInterface.addIndex('auth_sessions', ['user_id'])
      await queryInterface.addIndex('auth_sessions', ['station_id'])
    }

    const refreshColumns = await queryInterface.describeTable('refresh_tokens')
    if (!refreshColumns.session_id) {
      // Tokens issued before B3 (none in practice: the in-memory auth never
      // wrote this table) have no session and are rejected by the API.
      await queryInterface.addColumn('refresh_tokens', 'session_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'auth_sessions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      })
      await queryInterface.addIndex('refresh_tokens', ['session_id'])
    }
  },

  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('refresh_tokens')
    if (columns.session_id) {
      await queryInterface.removeColumn('refresh_tokens', 'session_id')
    }
    await queryInterface.dropTable('auth_sessions')
    await queryInterface.dropTable('stations')
  },
}
