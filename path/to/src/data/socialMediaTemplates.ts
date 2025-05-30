import { Template } from '../types/socialMedia'

// Bakery color palette - replace with actual brand colors
const BAKERY_COLORS = {
  primary: '#8B4513',     // Brown
  secondary: '#F5DEB3',   // Wheat
  background: '#FFFAF0',  // Floral white
  text: '#3E2723',        // Dark brown
  accent: '#FFD700'       // Gold
}

export const socialMediaTemplates: Template[] = [
  {
    id: 'tagesangebot-mittagstisch',
    name: 'Tagesangebot: Mittagstisch',
    type: 'daily-special',
    description: 'Template für den täglichen Mittagstisch',
    width: 1200,
    height: 1200,
    textElements: [
      {
        id: 'title',
        text: '',
        maxLength: 30,
        fontSize: 48,
        fontWeight: 'bold',
        placeholder: 'Mittagstisch am Freitag',
        required: true
      },
      {
        id: 'description',
        text: '',
        maxLength: 120,
        fontSize: 32,
        fontWeight: 'normal',
        placeholder: 'Beschreibung des Angebots...',
        required: true
      },
      {
        id: 'price',
        text: '',
        maxLength: 15,
        fontSize: 40,
        fontWeight: 'bold',
        placeholder: '9,90 €',
        required: true
      }
    ],
    imageElements: [
      {
        id: 'mealImage',
        required: false
      }
    ],
    colors: BAKERY_COLORS
  },
  {
    id: 'brot-des-tages',
    name: 'Brot des Tages',
    type: 'bread-of-day',
    description: 'Präsentation des täglichen Brotangebots',
    width: 1200,
    height: 1200,
    textElements: [
      {
        id: 'breadName',
        text: '',
        maxLength: 30,
        fontSize: 48,
        fontWeight: 'bold',
        placeholder: 'Dinkel-Vollkornbrot',
        required: true
      },
      {
        id: 'breadDescription',
        text: '',
        maxLength: 150,
        fontSize: 28,
        fontWeight: 'normal',
        placeholder: 'Beschreibung des Brotes...',
        required: true
      },
      {
        id: 'price',
        text: '',
        maxLength: 15,
        fontSize: 40,
        fontWeight: 'bold',
        placeholder: '4,20 €',
        required: true
      }
    ],
    imageElements: [
      {
        id: 'breadImage',
        required: true
      }
    ],
    colors: BAKERY_COLORS
  },
  // Add more templates for the other types
  // - Pizzatag, Schnittentag
  // - Seasonal offers
  // - Bakery news (closed, vacation, hiring)
]
