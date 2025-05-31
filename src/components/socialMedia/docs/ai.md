# Social Media Content Creator Documentation

## Overview
The Social Media Content Creator is a component designed for the bakery administration interface that enables staff to create professional-looking social media content with minimal effort. It generates branded images with text overlay that can be downloaded and used across various social media platforms.

## Features
- Pre-designed templates for different content types
- Text-focused design with optimal readability
- Brand-consistent styling with bakery logo integration
- Downloadable images ready for social media use
- Live preview of content before download
- Two alternative rendering methods for better cross-browser compatibility

## Templates
The content creator offers several template types:

### Daily Special (`daily-special`)
- Purpose: Highlighting lunch or daily meal specials
- Key fields: Title, Description, Price, Availability information
- Style: Primary color panel with white text

### Bread of the Day (`bread-of-day`)
- Purpose: Showcasing special bread offerings
- Key fields: Bread Name, Description, Price, Ingredients list
- Style: Primary color panel with product highlight badge

### Seasonal Offers (`offer`)
- Purpose: Promoting limited-time seasonal specials
- Key fields: Title, Description, Price, Validity period
- Style: White content area with highlighted price

### Bakery News (`bakery-news`)
- Purpose: Sharing news and announcements
- Key fields: News Title, News Content, Date/Period information
- Style: White content area with category labeling

### Simple Message (`message`)
- Purpose: Creating bold, text-focused announcements or quotes
- Key fields: Message text (large format)
- Variants: 
  - Primary background with white text
  - White background with primary color text

## Technical Implementation

### Architecture
The component is built with React and Material UI, following a modular approach:

- `SocialMediaContentCreator.tsx` - Main container component
- `TemplateSelector.tsx` - Template type selection tabs
- `SimpleContentForm.tsx` - Content input forms
- `ContentPreview.tsx` - Live preview of the generated content
- `DownloadButton.tsx` - Download handling with fallback options
- `fallbacks.ts` - Alternative render methods for cross-browser compatibility
- `imageGenerator.ts` - Canvas-based image generation algorithms

### Template Data Model
Templates are defined in `socialMediaTemplates.ts` with the following structure:
```typescript
interface Template {
  id: string;
  name: string;
  type: TemplateType; // 'daily-special', 'bread-of-day', 'offer', 'bakery-news', 'message'
  description: string;
  width: number;
  height: number;
  textElements: TextElement[];
  imageElements: ImageElement[];
  colors: ColorScheme;
  backgroundStyle?: string;
  textPanelStyle?: TextPanelStyle;
}
```

### Image Generation
The component uses Canvas API for generating images, with two rendering paths:
1. Primary method: HTML-to-image conversion (preview area to PNG)
2. Fallback method: Direct Canvas API drawing using template parameters

Each template has dedicated rendering logic in the `imageGenerator.ts` file, with custom text handling and layout algorithms.

## Brand Integration
All templates include consistent branding elements:
- Header with "Bäckerei Heusser" text
- Brand colors (primary: #D038BA)
- Bakery wappen/logo in the bottom right corner
- Consistent typography using "Averia Serif Libre" for headings

## Usage Guidelines
1. Select the appropriate template type from the tabs
2. Fill in the required fields (all fields marked with * are required)
3. Preview the content in the right panel
4. Use the theme switch if available (for message template)
5. Click the download button to save the image
6. If download issues occur, use the fallback methods described in the help dialog

## Future Improvements
- Additional templates for different content types
- Support for image uploads and backgrounds
- Enhanced typography options with font selection
- Multi-language support for international content
- Custom sizing for different platform requirements
- Animation effects for Instagram/Facebook Stories

## Troubleshooting
If images fail to download correctly:
- Try using Google Chrome instead of Safari or Firefox
- Refresh the page and try again
- Use the "Help" link under the download button for alternative methods
- For persistent issues, use screenshot functionality as a last resort