const { Notification, User } = require("../models");
const logger = require("../utils/logger");

const sampleNotifications = [
  {
    title: "Willkommen im Admin-Bereich",
    message: "Herzlich willkommen im neuen Benachrichtigungssystem. Hier erhalten Sie wichtige Updates.",
    type: "info",
    category: "system",
    priority: "medium",
  },
  {
    title: "Neue Bestellung eingegangen",
    message: "Eine neue Online-Bestellung (#12345) wurde aufgegeben und wartet auf Bestätigung.",
    type: "success",
    category: "order",
    priority: "high",
  },
  {
    title: "Niedriger Lagerbestand: Mehl",
    message: "Der Lagerbestand für Weizenmehl Type 550 ist niedrig (nur noch 10kg). Bitte nachbestellen.",
    type: "warning",
    category: "inventory",
    priority: "high",
  },
  {
    title: "Mitarbeiter-Update",
    message: "Max Müller hat sich für die Frühschicht am Samstag eingetragen.",
    type: "info",
    category: "staff",
    priority: "low",
  },
  {
    title: "System-Wartung geplant",
    message: "Am Sonntag, 03.02.2025, wird zwischen 02:00 und 04:00 Uhr eine Systemwartung durchgeführt.",
    type: "warning",
    category: "system",
    priority: "medium",
  },
];

async function seed() {
  try {
    logger.info("Starting notification seeder...");

    // Check if notifications already exist
    const existingNotifications = await Notification.count();
    if (existingNotifications > 0) {
      logger.info(`Found ${existingNotifications} existing notifications, skipping seeder`);
      return;
    }

    // Get the first admin user
    const adminUser = await User.findOne({
      where: { role: "admin" },
    });

    if (!adminUser) {
      logger.warn("No admin user found, creating notifications without user association");
    }

    // Create notifications
    const notificationsToCreate = sampleNotifications.map((notification) => ({
      ...notification,
      userId: adminUser?.id || null,
      read: false,
      metadata: {},
    }));

    const created = await Notification.bulkCreate(notificationsToCreate);
    logger.info(`Created ${created.length} sample notifications`);

    // Mark some as read for variety
    if (created.length > 2) {
      await created[0].update({ read: true });
      await created[1].update({ read: true });
      logger.info("Marked first 2 notifications as read");
    }
  } catch (error) {
    logger.error("Error in notification seeder:", error);
    throw error;
  }
}

module.exports = { seed };