import { TemplateType } from '../../../types/socialMedia'

// Template styling configuration
export interface TemplateStyleConfig {
  textPanel: {
    padding: string
    minHeight: string
  }
  typography: {
    title: {
      fontSize: string
      fontFamily?: string
    }
    description: {
      fontSize: string
      fontFamily?: string
    }
    price: {
      fontSize: string
      fontFamily?: string
    }
    additionalInfo: {
      fontSize: string
      fontFamily?: string
    }
  }
  layout: {
    showDescription: boolean
    showPrice: boolean
    formatHashtags: boolean
  }
  placeholders: {
    title: string
    description: string
    price: string
  }
}

// Template configurations
const TEMPLATE_CONFIGS: Record<TemplateType, TemplateStyleConfig> = {
  // Classic Templates
  'daily-special': {
    textPanel: {
      padding: '7% 15% 7% 8%',
      minHeight: '67%'
    },
    typography: {
      title: {
        fontSize: '56px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '28px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '42px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: true,
      formatHashtags: false
    },
    placeholders: {
      title: 'Tagesangebot eingeben...',
      description: 'Beschreibung eingeben...',
      price: '0,00 €'
    }
  },

  'bread-of-day': {
    textPanel: {
      padding: '7% 15% 7% 8%',
      minHeight: '67%'
    },
    typography: {
      title: {
        fontSize: '56px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '28px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '42px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: true,
      formatHashtags: false
    },
    placeholders: {
      title: 'Brot des Tages eingeben...',
      description: 'Beschreibung eingeben...',
      price: '0,00 €'
    }
  },

  'offer': {
    textPanel: {
      padding: '7% 15% 7% 8%',
      minHeight: '67%'
    },
    typography: {
      title: {
        fontSize: '56px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '28px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '42px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: true,
      formatHashtags: false
    },
    placeholders: {
      title: 'Angebot eingeben...',
      description: 'Beschreibung eingeben...',
      price: '0,00 €'
    }
  },

  'bakery-news': {
    textPanel: {
      padding: '7% 15% 7% 8%',
      minHeight: '67%'
    },
    typography: {
      title: {
        fontSize: '56px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '28px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '42px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: false,
      formatHashtags: false
    },
    placeholders: {
      title: 'Neuigkeiten eingeben...',
      description: 'Nachrichteninhalt eingeben...',
      price: '0,00 €'
    }
  },

  'message': {
    textPanel: {
      padding: '7% 15% 7% 8%',
      minHeight: '67%'
    },
    typography: {
      title: {
        fontSize: '72px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '28px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '42px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: false,
      showPrice: false,
      formatHashtags: false
    },
    placeholders: {
      title: 'Ihre Nachricht hier eingeben...',
      description: '',
      price: ''
    }
  },

  // Social Media Templates
  'facebook-post': {
    textPanel: {
      padding: '5% 10% 5% 5%',
      minHeight: '60%'
    },
    typography: {
      title: {
        fontSize: '40px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '22px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '32px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '20px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: true,
      formatHashtags: true
    },
    placeholders: {
      title: 'Facebook Post Titel...',
      description: 'Beschreibung für Facebook...',
      price: '0,00 €'
    }
  },

  'instagram-square': {
    textPanel: {
      padding: '7% 15% 7% 8%',
      minHeight: '67%'
    },
    typography: {
      title: {
        fontSize: '48px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '24px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '36px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '20px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: true,
      formatHashtags: true
    },
    placeholders: {
      title: 'Instagram Post...',
      description: 'Kurze Beschreibung...',
      price: '0,00 €'
    }
  },

  'instagram-story': {
    textPanel: {
      padding: '10% 8% 10% 8%',
      minHeight: '40%'
    },
    typography: {
      title: {
        fontSize: '60px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '28px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '42px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: false, // Only show if content.description exists
      showPrice: false,
      formatHashtags: true
    },
    placeholders: {
      title: 'Story Titel...',
      description: 'Story Text...',
      price: '0,00 €'
    }
  },

  // Website Templates
  'website-banner': {
    textPanel: {
      padding: '5% 15% 5% 5%',
      minHeight: '50%'
    },
    typography: {
      title: {
        fontSize: '52px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '26px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '30px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '22px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: false,
      formatHashtags: false
    },
    placeholders: {
      title: 'Banner Titel...',
      description: 'Untertitel...',
      price: '0,00 €'
    }
  },

  'website-card': {
    textPanel: {
      padding: '8% 10% 8% 10%',
      minHeight: '70%'
    },
    typography: {
      title: {
        fontSize: '32px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '18px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '22px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: true,
      showPrice: false,
      formatHashtags: false
    },
    placeholders: {
      title: 'Karten Titel...',
      description: 'Beschreibung...',
      price: '0,00 €'
    }
  },

  // Simple Square Template
  'simple-square': {
    textPanel: {
      padding: '10% 10% 10% 10%',
      minHeight: '80%'
    },
    typography: {
      title: {
        fontSize: '72px', // Base size - will be dynamically calculated
        fontFamily: "'Averia Serif Libre', serif"
      },
      description: {
        fontSize: '28px',
        fontFamily: "'Ubuntu', sans-serif"
      },
      price: {
        fontSize: '42px',
        fontFamily: "'Averia Serif Libre', serif"
      },
      additionalInfo: {
        fontSize: '24px',
        fontFamily: "'Averia Serif Libre', serif"
      }
    },
    layout: {
      showDescription: false,
      showPrice: false,
      formatHashtags: false
    },
    placeholders: {
      title: 'Ihre Nachricht hier...',
      description: '',
      price: ''
    }
  }
}

// Helper functions
export const getTemplateConfig = (templateType: TemplateType): TemplateStyleConfig => {
  return TEMPLATE_CONFIGS[templateType] || TEMPLATE_CONFIGS['daily-special']
}

export const shouldShowDescription = (templateType: TemplateType, hasDescription: boolean): boolean => {
  const config = getTemplateConfig(templateType)
  if (templateType === 'instagram-story') {
    return hasDescription // Only show if content exists
  }
  return config.layout.showDescription
}

export const shouldShowPrice = (templateType: TemplateType): boolean => {
  const config = getTemplateConfig(templateType)
  return config.layout.showPrice
}

export const formatAdditionalInfo = (info: string, templateType: TemplateType): string => {
  const config = getTemplateConfig(templateType)
  if (config.layout.formatHashtags) {
    return info.startsWith('#') ? info : `#${info.replace(/\s+/g, ' #')}`
  }
  return info
}

export const getPlaceholderText = (templateType: TemplateType, field: keyof TemplateStyleConfig['placeholders']): string => {
  const config = getTemplateConfig(templateType)
  return config.placeholders[field]
}