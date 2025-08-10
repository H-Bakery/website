# Static Hosting Notes for Bakery Landing Page

## Product Detail Pages

When deployed as a static site (using `output: 'export'`), product detail pages work differently than in development:

### Current Behavior

- **Direct URL access** to `/products/1` won't work on static hosting (GitHub Pages, etc.)
- Product pages are only accessible through **client-side navigation** from the products listing page
- This is the expected behavior for Next.js static export with dynamic routes

### Why This Happens

Next.js static export doesn't generate individual HTML files for dynamic routes like `/products/[id]` unless:

1. You use `generateStaticParams` (which we have)
2. AND the build completes successfully (currently having build issues)

### Workarounds for Production

#### Option 1: Client-Side Only (Current)

- Users must navigate to products from the `/products` listing page
- Direct links to product pages won't work
- SEO impact: Individual products won't be indexed

#### Option 2: Fix Static Generation (Recommended)

To enable direct URL access to product pages:

1. Fix the build issues preventing static generation
2. Use `trailingSlash: true` in `next.config.js` for better static hosting compatibility
3. Configure proper redirects on your hosting platform

#### Option 3: Use Server-Side Rendering

If direct product URLs are critical:

- Deploy to Vercel or similar platform that supports SSR
- Change from static export to regular Next.js deployment

### Temporary Solution for Testing

For local testing with static files, use the provided `serve.json` configuration:

```bash
npx serve out -p 3000 -c serve.json
```

This configuration includes URL rewrites to handle product routes correctly.

## Deployment Recommendations

For GitHub Pages deployment:

- Accept the limitation of client-side only navigation for products
- OR implement a custom 404.html that handles client-side routing
- OR consider using Vercel for full Next.js features

For other static hosting (Netlify, Vercel with static export):

- Configure redirects/rewrites in platform-specific config files
- Example for Vercel: Add `vercel.json` with rewrite rules
- Example for Netlify: Add `_redirects` file
