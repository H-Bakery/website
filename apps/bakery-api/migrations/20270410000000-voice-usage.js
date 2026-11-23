'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, BOOLEAN } = Sequelize
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'voice_usage',
        {
          id: { type: INTEGER, primaryKey: true, autoIncrement: true },
          started_ms: { type: Sequelize.BIGINT, allowNull: false },
          month: { type: STRING, allowNull: false },
          user_id: { type: INTEGER, allowNull: false },
          screen: { type: STRING, allowNull: false },
          duration_ms: { type: INTEGER, allowNull: false },
          stt_provider: { type: STRING, allowNull: false },
          input_tokens: { type: INTEGER, allowNull: false, defaultValue: 0 },
          output_tokens: { type: INTEGER, allowNull: false, defaultValue: 0 },
          cache_read_tokens: {
            type: INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          cache_write_tokens: {
            type: INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          cost_micro_eur: { type: INTEGER, allowNull: false },
          outcome: { type: STRING, allowNull: false },
          llm_used: { type: BOOLEAN, allowNull: false, defaultValue: false },
          budget_warning_month: { type: STRING, unique: true },
        },
        { transaction }
      )
      await queryInterface.addIndex('voice_usage', ['month'], { transaction })
      await queryInterface.addIndex('voice_usage', ['user_id', 'started_ms'], {
        transaction,
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('voice_usage')
  },
}
