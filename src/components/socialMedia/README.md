# Social Media Content Creator - Clean Architecture

## 📁 Project Structure

```
socialMedia/
├── SocialMediaContentCreator.tsx     # Main container component
├── README.md                         # This documentation
├── ai.md                            # Overview documentation
├── config/
│   └── templateConfig.ts            # Template styling configuration
├── core/                           # Core UI components
│   ├── ContentPreview.tsx          # Live preview component
│   ├── DownloadButton.tsx          # Download functionality
│   ├── SimpleContentForm.tsx       # Input form component
│   ├── TemplateSelector.tsx        # Template selection UI
│   ├── fallbacks.ts               # Image generation fallbacks
│   ├── imageGenerator.ts          # Canvas-based image generation
│   └── styles.ts                  # Shared styles
├── docs/
│   └── ai.md                      # Detailed documentation
└── utils/
    └── contentMapper.ts           # Content mapping utilities
```

## 🏗️ Architecture Overview

### Configuration-Driven Design
- **`templateConfig.ts`** - Centralized configuration for all template styling
- **Type-safe configurations** with TypeScript interfaces
- **Platform-specific settings** (Facebook, Instagram, Website)
- **Reusable helper functions** for consistency

### Utility Functions
- **`contentMapper.ts`** - Maps generic content to template-specific fields
- **`getTemplateForType()`** - Template selection logic
- **`mapContentToTemplate()`** - Content transformation

### Component Separation
- **UI Components** handle rendering and user interaction
- **Configuration** handles styling and behavior rules
- **Utilities** handle data transformation and logic

## 🎨 Template System

### Template Types
```typescript
type TemplateType = 
  | 'daily-special' | 'bread-of-day' | 'offer' | 'bakery-news' | 'message'  // Classic
  | 'facebook-post' | 'instagram-square' | 'instagram-story'                // Social Media
  | 'website-banner' | 'website-card'                                      // Website
```

### Configuration Structure
```typescript
interface TemplateStyleConfig {
  textPanel: { padding: string; minHeight: string }
  typography: {
    title: { fontSize: string; fontFamily?: string }
    description: { fontSize: string; fontFamily?: string }
    price: { fontSize: string; fontFamily?: string }
    additionalInfo: { fontSize: string; fontFamily?: string }
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
```

## 🔧 Key Improvements

### ✅ Clean Code Principles
- **Single Responsibility** - Each file has one clear purpose
- **DRY (Don't Repeat Yourself)** - Configuration eliminates duplicated styling logic
- **SOLID Principles** - Interfaces and dependency injection
- **Type Safety** - Comprehensive TypeScript types

### ✅ Maintainability
- **Centralized Configuration** - Easy to modify template styling
- **Modular Architecture** - Components can be modified independently
- **Clear Separation of Concerns** - UI, logic, and configuration are separate
- **Documented APIs** - Clear interfaces and helper functions

### ✅ Extensibility
- **Easy to add new templates** - Just add to configuration
- **Platform-specific optimizations** - Built-in support for different platforms
- **Consistent API** - All templates use the same interface

### ✅ Performance
- **No runtime calculations** - Configurations are pre-defined
- **Efficient re-renders** - Components only update when necessary
- **Optimized imports** - Only import what's needed

## 🎯 Usage Examples

### Adding a New Template
```typescript
// 1. Add to templateConfig.ts
'new-template': {
  textPanel: { padding: '8%', minHeight: '60%' },
  typography: {
    title: { fontSize: '48px', fontFamily: "'Arial', sans-serif" }
    // ...
  },
  // ...
}

// 2. Add to types (if needed)
type TemplateType = '...' | 'new-template'

// 3. Update contentMapper.ts if special mapping needed
```

### Customizing Template Styling
```typescript
// Simply modify the configuration in templateConfig.ts
'facebook-post': {
  typography: {
    title: { fontSize: '44px' } // Changed from 40px
  }
}
```

## 🚀 Benefits of Refactoring

### Before (Problems)
- ❌ Inline conditional logic everywhere
- ❌ Duplicated styling code
- ❌ Hard to maintain and extend
- ❌ Runtime errors from undefined functions
- ❌ No clear separation of concerns

### After (Solutions)
- ✅ Clean, readable, maintainable code
- ✅ Type-safe configuration system
- ✅ Easy to add new templates
- ✅ Consistent API across all templates
- ✅ No runtime errors
- ✅ Clear documentation and structure

## 📝 Contributing Guidelines

1. **Follow the configuration pattern** - Use `templateConfig.ts` for styling
2. **Add TypeScript types** - Ensure type safety
3. **Update tests** - If adding new functionality
4. **Document changes** - Update README and comments
5. **Follow naming conventions** - Use descriptive, consistent names

## 🧪 Testing Strategy

- **Unit tests** for utility functions
- **Component tests** for UI components
- **Integration tests** for the complete flow
- **Type checking** with TypeScript
- **Visual regression tests** for template output

This refactored architecture provides a solid foundation for maintaining and extending the Social Media Content Creator while ensuring code quality and developer experience.