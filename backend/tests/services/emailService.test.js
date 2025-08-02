const emailService = require("../../services/emailService");

describe("EmailService", () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASSWORD;
  });

  describe("initialization", () => {
    it("should initialize without configuration", () => {
      expect(emailService).toBeDefined();
      expect(emailService.isConfigured).toBe(false);
    });

    it("should handle missing configuration gracefully", async () => {
      const result = await emailService.sendNotificationEmail(
        { title: "Test", message: "Test message" },
        "test@example.com"
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Email service not configured");
    });
  });

  describe("shouldSendEmail", () => {
    it("should return false for broadcast emails without env setting", async () => {
      const result = await emailService.shouldSendEmail(null, {
        category: "order",
        priority: "medium",
      });
      
      expect(result).toBe(false);
    });
  });

  describe("email templates", () => {
    it("should generate HTML email content", () => {
      const notification = {
        title: "Test Notification",
        message: "This is a test message",
        category: "order",
        priority: "medium",
      };
      
      const html = emailService.generateEmailHtml(notification, "de");
      
      expect(html).toContain("Test Notification");
      expect(html).toContain("This is a test message");
      expect(html).toContain("Bestellungen"); // German translation for "order"
    });

    it("should generate text email content", () => {
      const notification = {
        title: "Test Notification",
        message: "This is a test message",
        category: "order",
        priority: "high",
      };
      
      const text = emailService.generateEmailText(notification);
      
      expect(text).toContain("Test Notification");
      expect(text).toContain("This is a test message");
      expect(text).toContain("order");
      expect(text).toContain("high");
    });

    it("should handle priority badges correctly", () => {
      const prioritiesGerman = {
        low: "Niedrig",
        medium: "Mittel", 
        high: "Hoch",
        urgent: "Dringend",
      };
      
      Object.entries(prioritiesGerman).forEach(([priority, germanLabel]) => {
        const html = emailService.getPriorityBadgeHtml(priority, "de");
        expect(html).toContain(germanLabel);
      });
    });

    it("should translate categories correctly", () => {
      const categories = {
        staff: { de: "Personal", en: "Staff" },
        order: { de: "Bestellungen", en: "Orders" },
        system: { de: "System", en: "System" },
      };
      
      Object.entries(categories).forEach(([category, translations]) => {
        expect(emailService.translateCategory(category, "de")).toBe(translations.de);
        expect(emailService.translateCategory(category, "en")).toBe(translations.en);
      });
    });
  });

  describe("templated emails", () => {
    it("should handle templated email requests when not configured", async () => {
      const result = await emailService.sendTemplatedEmail(
        "order.new",
        { orderId: "123", customerName: "Test Customer" },
        "test@example.com"
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Email service not configured");
    });
  });

  describe("bulk emails", () => {
    it("should handle bulk email requests when not configured", async () => {
      const notifications = [
        { title: "Test 1", message: "Message 1" },
        { title: "Test 2", message: "Message 2" },
      ];
      
      const recipients = [
        { email: "test1@example.com", notificationIndex: 0, language: "de" },
        { email: "test2@example.com", notificationIndex: 1, language: "en" },
      ];
      
      const result = await emailService.sendBulkEmails(notifications, recipients);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Email service not configured");
    });
  });
});