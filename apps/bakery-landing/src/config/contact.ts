/**
 * Contact configuration for the bakery
 * This centralizes all contact information for easy updates
 */

import { LEGAL } from './legal'

export const contactConfig = {
  whatsapp: {
    // WhatsApp number in international format without + or spaces
    number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '491706133279',
    // Fallback contact methods if WhatsApp is not available
    fallback: {
      phone: process.env.NEXT_PUBLIC_PHONE_NUMBER || '+49 170 6133279',
      email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || LEGAL.email,
    },
    // Default message template
    defaultMessage: 'Hallo! Ich möchte gerne bestellen.',
  },
  // Store contact information
  store: {
    phone: process.env.NEXT_PUBLIC_STORE_PHONE || '+49 6841 2229',
    email: process.env.NEXT_PUBLIC_STORE_EMAIL || LEGAL.email,
    address: {
      street: 'Eckstraße 3',
      city: 'Homburg/Kirrberg',
      postalCode: '66424',
      country: 'Deutschland',
    },
  },
  // Social media links
  social: {
    instagram: LEGAL.social.instagram,
    facebook: LEGAL.social.facebook,
  },
}

/**
 * Helper function to create WhatsApp link with message
 */
export const createWhatsAppLink = (message?: string): string => {
  const { number, defaultMessage } = contactConfig.whatsapp
  const text = message || defaultMessage
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/**
 * Helper function to create phone link
 */
export const createPhoneLink = (phoneNumber?: string): string => {
  const number = phoneNumber || contactConfig.store.phone
  // Remove spaces and special characters for tel: link
  const cleanNumber = number.replace(/[\s\-\(\)]/g, '')
  return `tel:${cleanNumber}`
}

/**
 * Helper function to create email link
 */
export const createEmailLink = (email?: string, subject?: string): string => {
  const address = email || contactConfig.store.email
  const params = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  return `mailto:${address}${params}`
}
