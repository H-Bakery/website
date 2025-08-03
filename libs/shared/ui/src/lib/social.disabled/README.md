# Social Media Components

Components for social media integration and content creation for the bakery.

## Components

### Socials

Simple social media links component.

```tsx
import { Socials } from '@bakery/shared/ui'

;<Socials
  facebook="https://facebook.com/baeckerei-heusser"
  instagram="https://instagram.com/baeckerei_heusser"
  whatsapp="+41xxxxxxxxx"
  size="medium"
/>
```

### SocialMediaContentCreator

Advanced component for creating social media content with templates and customization.

```tsx
import { SocialMediaContentCreator } from '@bakery/shared/ui'

;<SocialMediaContentCreator
  templates={contentTemplates}
  onContentCreated={handleContentCreated}
  bakeryInfo={bakeryDetails}
/>
```

## Features

### Social Links

- Configurable social media platform links
- Icon support for major platforms (Facebook, Instagram, WhatsApp)
- Responsive sizing options
- Custom styling support

### Content Creator

- Template-based content generation
- Image and text customization
- Preview functionality
- Export capabilities
- Brand consistency enforcement

## Usage Notes

- Ensure proper social media URLs are provided
- Content creator requires additional dependencies for image processing
- Test thoroughly on mobile devices for social sharing functionality
- Follow platform-specific guidelines for content dimensions and formats
