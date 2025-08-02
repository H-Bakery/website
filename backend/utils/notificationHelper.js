const { Notification, User } = require("../models");
const socketService = require("../services/socketService");
const templateService = require("../services/templateService");
const emailService = require("../services/emailService");
const emailQueueService = require("../services/emailQueueService");
const logger = require("./logger");

/**
 * Helper functions for creating notifications
 */

// Helper function to send email notifications using queue
async function sendEmailForNotification(notification, userId = null) {
  try {
    if (userId) {
      // Send to specific user
      const user = await User.findByPk(userId);
      if (user && user.email && await emailService.shouldSendEmail(userId, notification)) {
        emailQueueService.addToQueue(notification, user.email, userId, "de");
      }
    } else {
      // Send to all users with email enabled (for broadcast notifications)
      const users = await User.findAll({
        where: { 
          email: { [require("sequelize").Op.ne]: null },
          isActive: true 
        }
      });

      const emailRecipients = [];
      for (const user of users) {
        if (await emailService.shouldSendEmail(user.id, notification)) {
          emailRecipients.push({
            email: user.email,
            userId: user.id,
            notificationIndex: 0,
            language: "de" // TODO: Add language preference to user model
          });
        }
      }

      if (emailRecipients.length > 0) {
        emailQueueService.addBulkToQueue([notification], emailRecipients);
      }
    }
  } catch (error) {
    logger.error("Error queueing email for notification:", error);
    // Don't throw - email failures shouldn't break notification creation
  }
}

// Create notification for low inventory
async function createLowInventoryNotification(item, currentStock, minStock, unit = "Stück") {
  try {
    // Use template
    const notificationData = await templateService.renderTemplate(
      "inventory.low_stock",
      { item, currentStock, unit, minStock },
      "de"
    );

    const notification = await Notification.create({
      ...notificationData,
      userId: null, // Broadcast to all admin users
    });

    // Broadcast to all users
    socketService.broadcastNotification(notification);
    logger.info(`Low inventory notification created for ${item}`);
    
    // Send email notifications
    await sendEmailForNotification(notification);
    
    return notification;
  } catch (error) {
    logger.error("Error creating low inventory notification:", error);
    throw error;
  }
}

// Create notification for new order
async function createNewOrderNotification(orderData) {
  try {
    // Format pickup date
    const pickupDate = orderData.pickupDate ? 
      new Date(orderData.pickupDate).toLocaleDateString("de-DE") : 
      "N/A";

    // Use template
    const notificationData = await templateService.renderTemplate(
      "order.new",
      {
        orderId: orderData.id,
        customerName: orderData.customerName,
        pickupDate,
        totalAmount: orderData.totalAmount || "0",
      },
      "de"
    );

    const notification = await Notification.create({
      ...notificationData,
      userId: null, // Broadcast to all users
    });

    // Broadcast to all users
    socketService.broadcastNotification(notification);
    logger.info(`New order notification created for order #${orderData.id}`);
    
    // Send email notifications
    await sendEmailForNotification(notification);
    
    return notification;
  } catch (error) {
    logger.error("Error creating new order notification:", error);
    throw error;
  }
}

// Create notification for staff updates
async function createStaffNotification(type, staffData) {
  try {
    let templateKey, variables;
    
    switch (type) {
      case "sick_leave":
        templateKey = "staff.sick_leave";
        variables = {
          staffName: staffData.name,
          date: staffData.date,
          coverageInfo: staffData.coverageInfo || "Vertretung wird noch organisiert",
        };
        break;
      case "shift_change":
        templateKey = "staff.shift_change";
        variables = {
          staffName: staffData.name,
          date: staffData.date,
          newTime: staffData.newTime || "TBD",
          reason: staffData.reason || "Persönliche Gründe",
        };
        break;
      case "new_employee":
        templateKey = "staff.new_employee";
        variables = {
          staffName: staffData.name,
          position: staffData.position || "Mitarbeiter",
          startDate: staffData.startDate || "Sofort",
        };
        break;
      default:
        throw new Error(`Unknown staff notification type: ${type}`);
    }

    // Use template
    const notificationData = await templateService.renderTemplate(
      templateKey,
      variables,
      "de"
    );

    const notification = await Notification.create({
      ...notificationData,
      userId: null, // Broadcast to all managers
    });

    // Send to all users with management role
    socketService.sendNotificationToRole("admin", notification);
    socketService.sendNotificationToRole("Management", notification);
    logger.info(`Staff notification created: ${type} for ${staffData.name}`);
    
    // Send email notifications to managers
    await sendEmailForNotification(notification);
    
    return notification;
  } catch (error) {
    logger.error("Error creating staff notification:", error);
    throw error;
  }
}

// Create system notification
async function createSystemNotification(type, data) {
  try {
    let templateKey, variables;
    
    switch (type) {
      case "backup_complete":
        templateKey = "system.backup_complete";
        variables = {
          backupSize: data.backupSize || "Unknown",
          duration: data.duration || "Unknown",
        };
        break;
      case "maintenance_scheduled":
        templateKey = "system.maintenance_scheduled";
        variables = {
          date: data.date,
          startTime: data.startTime || "TBD",
          endTime: data.endTime || "TBD",
          affectedServices: data.affectedServices || "Alle Services",
        };
        break;
      case "error":
        templateKey = "system.error";
        variables = {
          errorMessage: data.message || "Ein Systemfehler ist aufgetreten",
          component: data.component || "Unbekannt",
        };
        break;
      default:
        throw new Error(`Unknown system notification type: ${type}`);
    }

    // Use template
    const notificationData = await templateService.renderTemplate(
      templateKey,
      variables,
      "de"
    );

    const notification = await Notification.create({
      ...notificationData,
      userId: null,
    });

    // Broadcast based on priority
    if (notification.priority === "urgent") {
      socketService.broadcastNotification(notification);
    } else {
      socketService.sendNotificationToRole("admin", notification);
    }
    
    logger.info(`System notification created: ${type}`);
    
    // Send email notifications
    await sendEmailForNotification(notification);
    
    return notification;
  } catch (error) {
    logger.error("Error creating system notification:", error);
    throw error;
  }
}

// Create notification for specific user
async function createUserNotification(userId, notificationData) {
  try {
    const notification = await Notification.create({
      ...notificationData,
      userId,
      read: false,
    });

    // Send to specific user
    socketService.sendNotificationToUser(userId, notification);
    logger.info(`User notification created for user ${userId}`);
    
    // Send email notification to user
    await sendEmailForNotification(notification, userId);
    
    return notification;
  } catch (error) {
    logger.error("Error creating user notification:", error);
    throw error;
  }
}

// Create notification from template
async function createNotificationFromTemplate(templateKey, variables, options = {}) {
  try {
    const {
      userId = null,
      language = "de",
      broadcast = false,
      role = null,
    } = options;

    // Render template
    const notificationData = await templateService.renderTemplate(
      templateKey,
      variables,
      language
    );

    // Create notification
    const notification = await Notification.create({
      ...notificationData,
      userId,
    });

    // Send notification based on options
    if (broadcast) {
      socketService.broadcastNotification(notification);
      // Send email to all users
      await sendEmailForNotification(notification);
    } else if (role) {
      socketService.sendNotificationToRole(role, notification);
      // Send email to role members
      await sendEmailForNotification(notification);
    } else if (userId) {
      socketService.sendNotificationToUser(userId, notification);
      // Send email to specific user
      await sendEmailForNotification(notification, userId);
    }

    logger.info(`Notification created from template: ${templateKey}`);
    return notification;
  } catch (error) {
    logger.error(`Error creating notification from template ${templateKey}:`, error);
    throw error;
  }
}

module.exports = {
  createLowInventoryNotification,
  createNewOrderNotification,
  createStaffNotification,
  createSystemNotification,
  createUserNotification,
  createNotificationFromTemplate,
};