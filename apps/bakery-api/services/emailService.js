const logger = require('../utils/logger')

const categoryTranslations = {
  staff: { de: 'Personal', en: 'Staff' },
  order: { de: 'Bestellungen', en: 'Orders' },
  system: { de: 'System', en: 'System' },
  inventory: { de: 'Inventar', en: 'Inventory' },
  production: { de: 'Produktion', en: 'Production' },
}

const priorityTranslations = {
  low: { de: 'Niedrig', en: 'Low' },
  medium: { de: 'Mittel', en: 'Medium' },
  high: { de: 'Hoch', en: 'High' },
  urgent: { de: 'Dringend', en: 'Urgent' },
}

const isConfigured = !!(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASSWORD
)

function translateCategory(category, language = 'de') {
  const cat = categoryTranslations[category]
  if (!cat) return category
  return cat[language] || cat.en || category
}

function getPriorityBadgeHtml(priority, language = 'de') {
  const label = priorityTranslations[priority]
    ? priorityTranslations[priority][language] || priority
    : priority
  return `<span class="priority-badge priority-${priority}">${label}</span>`
}

function generateEmailHtml(notification, language = 'de') {
  const categoryLabel = translateCategory(notification.category, language)
  const priorityBadge = getPriorityBadgeHtml(notification.priority, language)

  return `<html>
<body>
<h1>${notification.title}</h1>
<p>${notification.message}</p>
<p>Kategorie: ${categoryLabel}</p>
${priorityBadge}
</body>
</html>`
}

function generateEmailText(notification) {
  return `${notification.title}\n\n${notification.message}\n\nCategory: ${notification.category}\nPriority: ${notification.priority}`
}

async function shouldSendEmail(email, notification) {
  if (!email) return false
  if (!isConfigured) return false
  return true
}

async function sendNotificationEmail(notification, email) {
  if (!isConfigured) {
    return { success: false, error: 'Email service not configured' }
  }

  try {
    // Send email logic would go here
    return { success: true }
  } catch (error) {
    logger.error('Email send error:', error)
    return { success: false, error: error.message }
  }
}

async function sendTemplatedEmail(template, data, email) {
  if (!isConfigured) {
    return { success: false, error: 'Email service not configured' }
  }

  try {
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function sendBulkEmails(notifications, recipients) {
  if (!isConfigured) {
    return { success: false, error: 'Email service not configured' }
  }

  try {
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

module.exports = {
  isConfigured,
  sendNotificationEmail,
  shouldSendEmail,
  generateEmailHtml,
  generateEmailText,
  getPriorityBadgeHtml,
  translateCategory,
  sendTemplatedEmail,
  sendBulkEmails,
}
