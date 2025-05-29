#!/bin/bash

# Script to generate AI-friendly documentation for a Next.js frontend with App Router
OUTPUT_FILE="frontend_summary.md"

echo "# Frontend Application Summary" > "$OUTPUT_FILE"
echo "This file contains essential information about the Next.js frontend application using App Router." >> "$OUTPUT_FILE"
echo "Generated on $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Configuration files
echo "## Core Configuration" >> "$OUTPUT_FILE"
echo "### Package.json" >> "$OUTPUT_FILE"
echo '```json' >> "$OUTPUT_FILE"
cat package.json | grep -v "\"description\":" | grep -v "\"license\":" >> "$OUTPUT_FILE" || echo "package.json not found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Next.js Configuration" >> "$OUTPUT_FILE"
echo '```javascript' >> "$OUTPUT_FILE"
cat next.config.js >> "$OUTPUT_FILE" 2>/dev/null || echo "next.config.js not found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Directory structure (simplified)
echo "## Project Structure" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
find ./src -type d -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/out/*" -not -path "*/\.*" | sort >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# App directory structure
echo "## App Directory Structure" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
find ./src/app -type d | sort >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Root layout and page
echo "## App Router Files" >> "$OUTPUT_FILE"
echo "### Root Layout" >> "$OUTPUT_FILE"
if [ -f "./src/app/layout.js" ] || [ -f "./src/app/layout.tsx" ]; then
  echo '```jsx' >> "$OUTPUT_FILE"
  cat ./src/app/layout.js 2>/dev/null || cat ./src/app/layout.tsx 2>/dev/null >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
else
  echo "Root layout file not found" >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "### Home Page" >> "$OUTPUT_FILE"
if [ -f "./src/app/page.js" ] || [ -f "./src/app/page.tsx" ]; then
  echo '```jsx' >> "$OUTPUT_FILE"
  cat ./src/app/page.js 2>/dev/null || cat ./src/app/page.tsx 2>/dev/null >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
else
  echo "Home page file not found" >> "$OUTPUT_FILE"
fi

# Route groups and nested routes
echo "" >> "$OUTPUT_FILE"
echo "## Route Groups and Pages" >> "$OUTPUT_FILE"
find ./src/app -name "page.js" -o -name "page.tsx" | grep -v "src/app/page" | sort >> "$OUTPUT_FILE"

# Sample a couple of route pages
echo "" >> "$OUTPUT_FILE"
echo "### Sample Route Pages" >> "$OUTPUT_FILE"

# Find up to 2 representative route pages
find ./src/app -name "page.js" -o -name "page.tsx" | grep -v "src/app/page" | head -2 | while read route_page; do
  echo "" >> "$OUTPUT_FILE"
  echo "#### $(echo $route_page | sed 's|./src/app/||g' | sed 's|/page\.js.*$||' | sed 's|/page\.tsx.*$||')" >> "$OUTPUT_FILE"
  echo '```jsx' >> "$OUTPUT_FILE"
  cat "$route_page" >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
done

# Components
echo "" >> "$OUTPUT_FILE"
echo "## Components" >> "$OUTPUT_FILE"
if [ -d "./src/components" ]; then
  echo "### Component Files" >> "$OUTPUT_FILE"
  find ./src/components -type f -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | sort >> "$OUTPUT_FILE"

  # Sample a few key components (up to 3)
  echo "" >> "$OUTPUT_FILE"
  echo "### Sample Components" >> "$OUTPUT_FILE"

  # Find up to 3 representative components that aren't too large
  find ./src/components -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) -size -10k | head -3 | while read comp; do
    echo "" >> "$OUTPUT_FILE"
    echo "#### $(basename "$comp")" >> "$OUTPUT_FILE"
    echo '```jsx' >> "$OUTPUT_FILE"
    cat "$comp" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
  done
else
  # Check for components inside app directory (common in App Router projects)
  echo "### App Directory Components" >> "$OUTPUT_FILE"
  find ./src/app -type f -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | grep -v "page\|layout\|loading\|error\|not-found" | sort >> "$OUTPUT_FILE"

  # Sample a few components from the app directory
  echo "" >> "$OUTPUT_FILE"
  echo "### Sample App Directory Components" >> "$OUTPUT_FILE"

  find ./src/app -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) -size -10k | grep -v "page\|layout\|loading\|error\|not-found" | head -3 | while read comp; do
    echo "" >> "$OUTPUT_FILE"
    echo "#### $(basename "$comp")" >> "$OUTPUT_FILE"
    echo '```jsx' >> "$OUTPUT_FILE"
    cat "$comp" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
  done
fi

# Styles
echo "" >> "$OUTPUT_FILE"
echo "## Styling" >> "$OUTPUT_FILE"
# Check global.css in app directory first (App Router pattern)
if [ -f "./src/app/globals.css" ]; then
  echo "### Global Styles" >> "$OUTPUT_FILE"
  echo '```css' >> "$OUTPUT_FILE"
  cat ./src/app/globals.css >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
elif [ -d "./src/styles" ]; then
  find ./src/styles -type f -name "*.css" -o -name "*.scss" | sort >> "$OUTPUT_FILE"

  # Include global styles
  if [ -f "./src/styles/globals.css" ] || [ -f "./src/styles/global.css" ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "### Global Styles" >> "$OUTPUT_FILE"
    echo '```css' >> "$OUTPUT_FILE"
    cat ./src/styles/globals.css 2>/dev/null || cat ./src/styles/global.css 2>/dev/null >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
  fi
fi

# API routes
echo "" >> "$OUTPUT_FILE"
echo "## API Routes" >> "$OUTPUT_FILE"
# App Router uses route handlers
find ./src/app/api -type d 2>/dev/null >> "$OUTPUT_FILE" || echo "No API routes found in src/app/api" >> "$OUTPUT_FILE"

# Find route handlers (route.js files)
API_ROUTES=$(find ./src/app/api -name "route.js" -o -name "route.ts" 2>/dev/null)
if [ ! -z "$API_ROUTES" ]; then
  echo "" >> "$OUTPUT_FILE"
  echo "### API Route Handlers" >> "$OUTPUT_FILE"
  echo "$API_ROUTES" >> "$OUTPUT_FILE"

  # Sample one API route
  API_ROUTE=$(echo "$API_ROUTES" | head -1)
  echo "" >> "$OUTPUT_FILE"
  echo "#### Sample API Route Handler" >> "$OUTPUT_FILE"
  echo '```javascript' >> "$OUTPUT_FILE"
  cat "$API_ROUTE" >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
fi

# Services or utils
echo "" >> "$OUTPUT_FILE"
echo "## Utilities and Services" >> "$OUTPUT_FILE"
for dir in src/utils src/services src/lib src/helpers; do
  if [ -d "./$dir" ]; then
    echo "### $dir Files" >> "$OUTPUT_FILE"
    find "./$dir" -type f -name "*.js" -o -name "*.ts" | sort >> "$OUTPUT_FILE"

    # Sample one file
    UTIL_FILE=$(find "./$dir" -type f \( -name "*.js" -o -name "*.ts" \) | head -1)
    if [ ! -z "$UTIL_FILE" ]; then
      echo "" >> "$OUTPUT_FILE"
      echo "#### Sample $(basename "$UTIL_FILE")" >> "$OUTPUT_FILE"
      echo '```javascript' >> "$OUTPUT_FILE"
      cat "$UTIL_FILE" >> "$OUTPUT_FILE"
      echo '```' >> "$OUTPUT_FILE"
    fi
  fi
done

echo "" >> "$OUTPUT_FILE"
echo "## Summary" >> "$OUTPUT_FILE"
echo "This file provides a high-level overview of the frontend application structure using Next.js App Router." >> "$OUTPUT_FILE"
echo "For detailed implementation, please refer to the actual code files." >> "$OUTPUT_FILE"

echo "Frontend summary has been generated in $OUTPUT_FILE"
