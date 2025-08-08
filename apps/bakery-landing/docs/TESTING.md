# Landing Page Testing Documentation

## Overview

This document outlines the testing procedures, known issues, and configuration for the bakery landing page. The testing infrastructure uses Playwright for browser automation and includes comprehensive health checks.

## Playwright Configuration

### Browser Viewport Configuration

To ensure screenshots are within Claude's image processing limits (8000px max dimension), we've implemented automatic viewport configuration:

```typescript
// Default viewport (1280x720)
const DESKTOP_DEFAULT = { width: 1280, height: 720 }

// Automatically applied before screenshots
await page.setViewportSize(getClaudeSafeViewport(viewport))
```

### Configuration Files

1. **`.claude/settings.json`** - Contains Playwright configuration:

   ```json
   {
     "playwright": {
       "defaultViewport": { "width": 1280, "height": 720 },
       "screenshotOptions": {
         "type": "jpeg",
         "quality": 80,
         "fullPage": false
       },
       "autoResize": true,
       "claudeMaxDimension": 8000
     }
   }
   ```

2. **`playwright-helpers/browser-config.ts`** - Helper functions for safe viewport and screenshot handling

## Running Tests

### Automated Test Script

Run the comprehensive test suite:

```bash
# From the landing page directory
cd apps/bakery-landing

# Run JavaScript version (recommended)
node scripts/playwright-test.js

# Or with custom URL
BASE_URL=http://localhost:4200 node scripts/playwright-test.js

# TypeScript version (requires additional configuration)
npx ts-node scripts/playwright-test.ts
```

### Playwright Test Suite

Run specific test categories:

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/frontend-health.test.ts

# Run with UI mode
npx playwright test --ui

# Generate HTML report
npx playwright test --reporter=html
```

## Test Categories

### 1. Health Tests

- Page loads without critical errors
- All main sections are visible
- Navigation links work correctly
- Images load successfully
- No console errors (except known issues)

### 2. Responsive Design Tests

- Mobile viewport (375x667)
- Tablet viewport (768x1024)
- Desktop viewport (1280x720)

### 3. Performance Tests

- Page load time < 3 seconds
- DOM content loaded < 3 seconds
- Core Web Vitals (LCP < 2.5s)

### 4. Accessibility Tests

- Proper heading hierarchy
- Alt text for images
- ARIA labels for interactive elements
- Keyboard navigation

### 5. Error Handling Tests

- 404 page handling
- API failure graceful degradation
- Network timeout handling

## Known Issues

### 1. Map Container Initialization Error (FIXED)

**Status**: ✅ FIXED  
**Error**: "Map container is already initialized"  
**Cause**: React StrictMode double-rendering in development  
**Solution**: Added unique key and proper cleanup in `OpenStreetMap.tsx`

```typescript
// Fix implemented
const [mapKey] = useState(() => `map-${Date.now()}-${Math.random()}`)
// Cleanup on unmount
return () => {
  if (mapRef.current) {
    mapRef.current.remove()
  }
}
```

### 2. Missing Favicon Files

**Status**: ✅ FIXED  
**Error**: 404 for favicon-16x16.png and favicon-32x32.png  
**Resolution**: Created favicon files using generate-favicons.js script  
**Files Added**:

- `/public/favicon-16x16.png`
- `/public/favicon-32x32.png`

### 3. Shared Library Dependencies (RESOLVED)

**Status**: ✅ RESOLVED  
**Previous Issue**: Landing page failed with shared library import errors  
**Resolution**: The issues documented in LANDING_PAGE_BUG_REPORT.md appear to be resolved. The page now loads successfully.

## Test Results Location

Test results are saved to:

- **Screenshots**: `apps/bakery-landing/test-results/screenshots/`
- **Reports**: `apps/bakery-landing/test-results/test-report.json`

## Screenshot Guidelines

### Taking Screenshots with Playwright

Always use the helper function to ensure Claude-compatible dimensions:

```typescript
import { takeClaudeSafeScreenshot } from '../playwright-helpers/browser-config'

// Safe screenshot
await takeClaudeSafeScreenshot(page, 'screenshot.jpg', {
  viewport: VIEWPORTS.DESKTOP_DEFAULT,
})

// Never use fullPage: true
// ❌ await page.screenshot({ fullPage: true })
// ✅ await page.screenshot({ fullPage: false })
```

### Available Viewports

```typescript
VIEWPORTS.DESKTOP_DEFAULT // 1280x720
VIEWPORTS.DESKTOP_FULL_HD // 1920x1080
VIEWPORTS.MOBILE_DEFAULT // 375x667
VIEWPORTS.TABLET_DEFAULT // 768x1024
```

## Continuous Integration

### GitHub Actions Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Run Landing Page Tests
  run: |
    cd apps/bakery-landing
    npm install
    npx playwright install chromium
    npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **Tests fail with timeout**

   - Ensure dev server is running: `nx serve bakery-landing`
   - Check BASE_URL environment variable
   - Increase timeout in test configuration

2. **Screenshot dimensions too large**

   - Always use `takeClaudeSafeScreenshot` helper
   - Never use `fullPage: true` option
   - Check viewport configuration

3. **Map loading errors**
   - These are caught by MapErrorBoundary
   - Non-critical for landing page functionality
   - Check network connectivity for OpenStreetMap tiles

### Debug Mode

Enable Playwright debug mode:

```bash
# Run with headed browser
npx playwright test --headed

# Run with debug mode
PWDEBUG=1 npx playwright test

# Save trace for debugging
npx playwright test --trace on
```

## Best Practices

1. **Always set viewport before screenshots**
2. **Use Claude-safe screenshot helper functions**
3. **Ignore known non-critical errors in tests**
4. **Test multiple viewports for responsive design**
5. **Include performance metrics in CI/CD pipeline**
6. **Regular accessibility audits**

## Test Script Files

### JavaScript Test Script (playwright-test.js)

- **Location**: `scripts/playwright-test.js`
- **Purpose**: Automated health check testing
- **Features**: Claude-safe screenshots, comprehensive test suite, JSON reports
- **Usage**: `node scripts/playwright-test.js`

### TypeScript Test Script (playwright-test.ts)

- **Location**: `scripts/playwright-test.ts`
- **Purpose**: Same as JavaScript version with TypeScript support
- **Note**: Requires TypeScript configuration to run

### Helper Script (generate-favicons.js)

- **Location**: `scripts/generate-favicons.js`
- **Purpose**: Generate missing favicon PNG files
- **Usage**: `node scripts/generate-favicons.js`

## Future Improvements

- [ ] Add visual regression testing
- [ ] Implement synthetic monitoring
- [ ] Add internationalization testing
- [ ] Expand accessibility testing with axe-core
- [ ] Add cross-browser testing (Firefox, Safari)
- [ ] Implement load testing for high traffic scenarios
