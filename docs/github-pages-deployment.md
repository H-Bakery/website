# GitHub Pages Deployment Guide

## Overview

The bakery landing page is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

## Deployment URL

- Production: https://xn--bckerei-heusser-0kb.de (Bäckerei Heusser)
- GitHub Pages URL: https://h-bakery.github.io/website

## Automatic Deployment

The site is automatically deployed via GitHub Actions when:

1. Code is pushed to the `main` branch
2. The workflow is manually triggered from GitHub Actions tab

### Workflow File

Location: `.github/workflows/deploy-to-github-pages.yml`

The workflow:

1. Checks out the code
2. Sets up Node.js 18
3. Installs dependencies
4. Builds the static site using `npx nx build-static-standalone bakery-landing`
5. Creates `.nojekyll` file for proper Next.js asset serving
6. Deploys to GitHub Pages with custom domain

## Manual Deployment

### Local Build

```bash
# Build the static site
npm run build:landing:standalone

# Test locally
cd apps/bakery-landing/out
npx serve
```

### Manual GitHub Pages Setup

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: gh-pages / root
4. Custom domain: xn--bckerei-heusser-0kb.de

## Build Optimizations

The production build includes:

- Image optimization with lazy loading
- Font preloading and optimization
- Bundle splitting for better caching
- Static HTML generation for all pages
- Minified CSS and JavaScript
- Cache headers configuration

### Bundle Analysis

To analyze the bundle size:

```bash
cd apps/bakery-landing
ANALYZE=true npx next build
```

This will generate reports in:

- `.next/analyze/client.html` - Client-side bundles
- `.next/analyze/server.html` - Server-side bundles

## Troubleshooting

### Common Issues

1. **404 on asset files**: Ensure `.nojekyll` file exists in the output directory
2. **Domain not working**: Check CNAME file and DNS settings
3. **Build failures**: Check Node.js version (should be 18+)
4. **Missing images**: Verify all images are in the `public` directory

### Checking Deployment Status

1. Go to the Actions tab in GitHub
2. Look for "Deploy to GitHub Pages" workflow
3. Check the latest run for success/failure
4. View deployment at Settings → Pages

## Performance Metrics

Current build metrics:

- Shared JS: ~101 kB
- First Load JS: ~320-333 kB per page
- Static HTML pages: 116 total
- Build time: ~2-3 minutes

## Security

- The deployment uses `GITHUB_TOKEN` for authentication
- No secrets or API keys are exposed in the static build
- All forms and dynamic features require separate API endpoints

## Maintenance

### Updating Dependencies

```bash
# Update all dependencies
npm update

# Check for outdated packages
npm outdated

# Update Next.js
npm install next@latest react@latest react-dom@latest
```

### Monitoring

- Check GitHub Pages status: https://www.githubstatus.com/
- Monitor site uptime with external services
- Review GitHub Actions logs for deployment issues
