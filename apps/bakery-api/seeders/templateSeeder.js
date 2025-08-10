const fs = require("fs").promises;
const path = require("path");
const { NotificationTemplate } = require("../models");
const logger = require("../utils/logger");

async function loadTemplatesFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    logger.error(`Error loading template file ${filePath}:`, error);
    return [];
  }
}

async function seed() {
  try {
    logger.info("Starting notification template seeder...");

    // Check if templates already exist
    const existingCount = await NotificationTemplate.count();
    if (existingCount > 0) {
      logger.info(`Found ${existingCount} existing templates. Skipping seed.`);
      return;
    }

    // Template files to load
    const templateFiles = [
      "inventory.json",
      "order.json",
      "production.json",
      "staff.json",
      "financial.json",
      "system.json",
      "customer.json",
    ];

    let totalTemplates = 0;

    // Load and create templates from each file
    for (const file of templateFiles) {
      const filePath = path.join(__dirname, "..", "templates", "notifications", file);
      const templates = await loadTemplatesFromFile(filePath);

      for (const templateData of templates) {
        try {
          await NotificationTemplate.create(templateData);
          totalTemplates++;
          logger.info(`Created template: ${templateData.key}`);
        } catch (error) {
          logger.error(`Error creating template ${templateData.key}:`, error);
        }
      }
    }

    logger.info(`Notification template seeder completed. Created ${totalTemplates} templates.`);
  } catch (error) {
    logger.error("Error in notification template seeder:", error);
    throw error;
  }
}

module.exports = { seed };