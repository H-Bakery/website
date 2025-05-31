# Social Media Content Creator

This component provides a user-friendly interface for creating branded social media images with text overlay. It's designed for bakery staff to quickly generate professional-looking content for platforms like Instagram, Facebook, and Twitter without requiring graphic design skills.

## Overview

The Social Media Content Creator allows users to:
- Select from multiple template types
- Enter custom text content
- Preview the result in real-time
- Download the generated image

## Component Structure

```
socialMedia/
├── SocialMediaContentCreator.tsx  # Main container component
├── core/                          # Core functionality components
│   ├── ContentPreview.tsx         # Live preview of the content
│   ├── DownloadButton.tsx         # Download handling with fallbacks
│   ├── SimpleContentForm.tsx      # Input form for content
│   ├── TemplateSelector.tsx       # Template type selection UI
│   ├── fallbacks.ts               # Alternative rendering methods
│   ├── imageGenerator.ts          # Canvas-based image generation
│   └── styles.ts                  # Shared styles
├── docs/                          # Documentation
│   └── ai.md                      # Detailed documentation
└── ai.md                          # This file - overview
```

## Template Types

The component provides several specialized templates:

1. **Daily Special** (`daily-special`)
   - Designed for lunch or meal specials
   - Features title, description, price, and availability

2. **Bread of the Day** (`bread-of-day`)
   - Showcases special bread offerings
   - Includes bread name, description, price, and ingredients

3. **Seasonal Offers** (`offer`)
   - Promotes limited-time specials
   - Contains title, description, price, and validity

4. **Bakery News** (`bakery-news`)
   - Shares announcements and information
   - Fields for news title, content, and date

5. **Simple Message** (`message`)
   - For bold, text-focused announcements
   - Available in two color variants (primary/white)

## Integration Points

- The component is part of the admin interface (`/admin/social-media`)
- Uses brand colors and styling defined in the project theme
- Leverages the bakery wappen (coat of arms) as a branding element
- Canvas API for image generation with browser compatibility fallbacks

## Technical Features

- Text wrapping and layout algorithms for optimal readability
- Responsive design with preview scaling
- Error handling with helpful user feedback
- Cross-browser compatibility with multiple rendering methods
- Local state management using React hooks

## Usage

The component is incorporated in the admin area with no additional configuration required. Users navigate to the social media page, select a template, enter content, and download the resulting image.

For more detailed information, see the [full documentation](./docs/ai.md).