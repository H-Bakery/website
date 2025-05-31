import { Template } from '../types/socialMedia'

// Bakery color palette - using corporate CI colors
const BAKERY_COLORS = {
  primary: '#D038BA',     // Corporate primary
  secondary: '#F6F8FC',   // Light background
  background: '#FFFFFF',  // White background
  text: '#131F37',        // Dark text
  accent: '#1ADA67',      // Success color accent
  highlight: '#FFD700'    // Gold highlight for text
}

// Message template variants
const MESSAGE_VARIANTS = {
  primaryBg: {
    background: '#D038BA',
    textColor: '#FFFFFF'
  },
  whiteBg: {
    background: '#FFFFFF',
    textColor: '#D038BA'
  }
}

// Background options for templates
const BACKGROUNDS = {
  plain: '#FFFFFF',
  lightGradient: 'linear-gradient(135deg, #FFFFFF 0%, #F6F8FC 100%)',
  primaryGradient: 'linear-gradient(135deg, #D038BA 0%, #E254C8 100%)',
  accentGradient: 'linear-gradient(135deg, #1ADA67 0%, #4CE58A 100%)',
  patternLight: 'url(/backgrounds/pattern-light.png)',
  patternDark: 'url(/backgrounds/pattern-dark.png)'
}

// Text-focused panel styles
const TEXT_PANELS = {
  primary: {
    background: 'rgba(208, 56, 186, 0.9)',
    textColor: '#FFFFFF'
  },
  light: {
    background: 'rgba(255, 255, 255, 0.9)',
    textColor: '#131F37'
  },
  dark: {
    background: 'rgba(19, 31, 55, 0.9)',
    textColor: '#FFFFFF'
  },
  accent: {
    background: 'rgba(26, 218, 103, 0.9)',
    textColor: '#FFFFFF'
  }
}

export const socialMediaTemplates: Template[] = [
  {
    id: 'simple-message',
    name: 'Einfache Nachricht',
    type: 'message',
    description: 'Große, einzelne Textnachricht ideal für Ankündigungen oder Zitate',
    width: 1080,
    height: 1080,
    textElements: [
      {
        id: 'message',
        text: '',
        maxLength: 150,
        fontSize: 72,
        fontWeight: 'bold',
        placeholder: 'Ihre Nachricht hier eingeben...',
        required: true
      },
      {
        id: 'variant',
        text: 'primary',
        maxLength: 10,
        fontSize: 0,
        fontWeight: 'normal',
        placeholder: 'primary',
        required: false,
        hidden: true
      }
    ],
    imageElements: [
      {
        id: 'backgroundImage',
        required: false,
        aspectRatio: '1:1',
        isBackground: true
      }
    ],
    colors: BAKERY_COLORS,
    backgroundStyle: MESSAGE_VARIANTS.primaryBg.background,
    textPanelStyle: MESSAGE_VARIANTS.primaryBg
  },
  {
    id: 'tagesangebot-mittagstisch',
    name: 'Tagesangebot: Mittagstisch',
    type: 'daily-special',
    description: 'Template für den täglichen Mittagstisch',
    width: 1080,
    height: 1080,
    textElements: [
      {
        id: 'title',
        text: '',
        maxLength: 30,
        fontSize: 56,
        fontWeight: 'bold',
        placeholder: 'Mittagstisch am Freitag',
        required: true
      },
      {
        id: 'subtitle',
        text: '',
        maxLength: 40,
        fontSize: 32,
        fontWeight: 'normal',
        placeholder: 'Unser Angebot für heute',
        required: false
      },
      {
        id: 'description',
        text: '',
        maxLength: 160,
        fontSize: 28,
        fontWeight: 'normal',
        placeholder: 'Detaillierte Beschreibung des Angebots mit allen Zutaten und Beilagen...',
        required: true
      },
      {
        id: 'price',
        text: '',
        maxLength: 15,
        fontSize: 46,
        fontWeight: 'bold',
        placeholder: '9,90 €',
        required: true
      },
      {
        id: 'callToAction',
        text: '',
        maxLength: 30,
        fontSize: 24,
        fontWeight: 'normal',
        placeholder: 'Verfügbar von 11:30 - 14:00 Uhr',
        required: false
      }
    ],
    imageElements: [
      {
        id: 'backgroundImage',
        required: false,
        aspectRatio: '1:1',
        isBackground: true
      },
      {
        id: 'mealImage',
        required: false,
        aspectRatio: '4:3'
      }
    ],
    colors: BAKERY_COLORS,
    backgroundStyle: BACKGROUNDS.plain,
    textPanelStyle: TEXT_PANELS.primary
  },
  {
    id: 'brot-des-tages',
    name: 'Brot des Tages',
    type: 'bread-of-day',
    description: 'Präsentation des täglichen Brotangebots',
    width: 1080,
    height: 1080,
    textElements: [
      {
        id: 'breadName',
        text: '',
        maxLength: 30,
        fontSize: 54,
        fontWeight: 'bold',
        placeholder: 'Dinkel-Vollkornbrot',
        required: true
      },
      {
        id: 'specialLabel',
        text: '',
        maxLength: 20,
        fontSize: 24,
        fontWeight: 'bold',
        placeholder: 'NEU | VEGAN | BIO',
        required: false,
        highlight: true
      },
      {
        id: 'breadDescription',
        text: '',
        maxLength: 180,
        fontSize: 26,
        fontWeight: 'normal',
        placeholder: 'Detaillierte Beschreibung des Brotes mit Zutaten, Herkunft und besonderen Merkmalen...',
        required: true
      },
      {
        id: 'ingredients',
        text: '',
        maxLength: 100,
        fontSize: 20,
        fontWeight: 'normal',
        placeholder: 'Zutaten: Dinkelmehl, Wasser, Sauerteig, Salz, Hefe',
        required: false
      },
      {
        id: 'price',
        text: '',
        maxLength: 15,
        fontSize: 42,
        fontWeight: 'bold',
        placeholder: '4,20 €',
        required: true
      }
    ],
    imageElements: [
      {
        id: 'backgroundImage',
        required: false,
        aspectRatio: '1:1',
        isBackground: true
      },
      {
        id: 'breadImage',
        required: false,
        aspectRatio: '1:1'
      }
    ],
    colors: BAKERY_COLORS,
    backgroundStyle: BACKGROUNDS.plain, 
    textPanelStyle: TEXT_PANELS.primary
  },
  {
    id: 'saisonales-angebot',
    name: 'Saisonales Angebot',
    type: 'offer',
    description: 'Präsentation von saisonalen Angeboten',
    width: 1080,
    height: 1080,
    textElements: [
      {
        id: 'season',
        text: '',
        maxLength: 20,
        fontSize: 28,
        fontWeight: 'normal',
        placeholder: 'HERBST 2023',
        required: false,
        highlight: true
      },
      {
        id: 'title',
        text: '',
        maxLength: 30,
        fontSize: 52,
        fontWeight: 'bold',
        placeholder: 'Herbst-Spezialitäten',
        required: true
      },
      {
        id: 'subtitle',
        text: '',
        maxLength: 40,
        fontSize: 32,
        fontWeight: 'normal',
        placeholder: 'Nur für kurze Zeit verfügbar!',
        required: false
      },
      {
        id: 'description',
        text: '',
        maxLength: 200,
        fontSize: 26,
        fontWeight: 'normal',
        placeholder: 'Ausführliche Beschreibung des saisonalen Angebots mit besonderem Fokus auf die Zutaten und saisonalen Besonderheiten...',
        required: true
      },
      {
        id: 'priceInfo',
        text: '',
        maxLength: 50,
        fontSize: 24,
        fontWeight: 'normal',
        placeholder: 'Preise ab 3,50 € je nach Auswahl',
        required: false
      },
      {
        id: 'callToAction',
        text: '',
        maxLength: 30,
        fontSize: 32,
        fontWeight: 'bold',
        placeholder: 'Jetzt probieren!',
        required: false
      }
    ],
    imageElements: [
      {
        id: 'backgroundImage',
        required: false,
        aspectRatio: '1:1',
        isBackground: true
      },
      {
        id: 'offerImage',
        required: false,
        aspectRatio: '4:3'
      }
    ],
    colors: BAKERY_COLORS,
    backgroundStyle: BACKGROUNDS.plain,
    textPanelStyle: TEXT_PANELS.primary
  },
  {
    id: 'bäckerei-news',
    name: 'Bäckerei Neuigkeiten',
    type: 'bakery-news',
    description: 'Informationen und Neuigkeiten über die Bäckerei',
    width: 1080,
    height: 1080,
    textElements: [
      {
        id: 'category',
        text: '',
        maxLength: 20,
        fontSize: 24,
        fontWeight: 'bold',
        placeholder: 'WICHTIGE INFORMATION',
        required: false,
        highlight: true
      },
      {
        id: 'newsTitle',
        text: '',
        maxLength: 50,
        fontSize: 48,
        fontWeight: 'bold',
        placeholder: 'Wichtige Mitteilung',
        required: true
      },
      {
        id: 'newsContent',
        text: '',
        maxLength: 250,
        fontSize: 24,
        fontWeight: 'normal',
        placeholder: 'Ausführliche Information zu unseren Neuigkeiten mit allen wichtigen Details für unsere Kunden...',
        required: true
      },
      {
        id: 'date',
        text: '',
        maxLength: 20,
        fontSize: 22,
        fontWeight: 'normal',
        placeholder: 'Gültig ab 01.05.2023',
        required: false
      },
      {
        id: 'contact',
        text: '',
        maxLength: 50,
        fontSize: 20,
        fontWeight: 'normal',
        placeholder: 'Weitere Infos: 0123-456789 oder info@example.com',
        required: false
      }
    ],
    imageElements: [
      {
        id: 'backgroundImage',
        required: false,
        aspectRatio: '1:1',
        isBackground: true
      },
      {
        id: 'newsImage',
        required: false,
        aspectRatio: '16:9'
      }
    ],
    colors: BAKERY_COLORS,
    backgroundStyle: BACKGROUNDS.plain,
    textPanelStyle: TEXT_PANELS.primary
  },
  {
    id: 'zitat-des-tages',
    name: 'Zitat des Tages',
    type: 'bakery-news',
    description: 'Inspirierendes Zitat im Bäckerei-Design',
    width: 1080,
    height: 1080,
    textElements: [
      {
        id: 'quote',
        text: '',
        maxLength: 180,
        fontSize: 42,
        fontWeight: 'bold',
        placeholder: 'Brot ist das wertvollste Lebensmittel. Es zu backen ist eine Kunst und zu teilen ein Zeichen der Freundschaft.',
        required: true
      },
      {
        id: 'author',
        text: '',
        maxLength: 50,
        fontSize: 24,
        fontWeight: 'normal',
        placeholder: '- Altes Bäcker-Sprichwort',
        required: false
      }
    ],
    imageElements: [
      {
        id: 'backgroundImage',
        required: false,
        aspectRatio: '1:1',
        isBackground: true
      }
    ],
    colors: BAKERY_COLORS,
    backgroundStyle: BACKGROUNDS.plain,
    textPanelStyle: TEXT_PANELS.primary
  },
  {
    id: 'simple-message-white',
    name: 'Nachricht (Weiß)',
    type: 'message',
    description: 'Große Nachricht auf weißem Hintergrund',
    width: 1080,
    height: 1080,
    textElements: [
      {
        id: 'message',
        text: '',
        maxLength: 150,
        fontSize: 72,
        fontWeight: 'bold',
        placeholder: 'Ihre Nachricht hier eingeben...',
        required: true
      },
      {
        id: 'variant',
        text: 'white',
        maxLength: 10,
        fontSize: 0,
        fontWeight: 'normal',
        placeholder: 'white',
        required: false,
        hidden: true
      }
    ],
    imageElements: [
      {
        id: 'backgroundImage',
        required: false,
        aspectRatio: '1:1',
        isBackground: true
      }
    ],
    colors: BAKERY_COLORS,
    backgroundStyle: MESSAGE_VARIANTS.whiteBg.background,
    textPanelStyle: MESSAGE_VARIANTS.whiteBg
  }
]
