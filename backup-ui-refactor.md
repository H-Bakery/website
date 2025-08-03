Implementation Details:                                                                                                                                │
│                                                                                                                                                        │
│ This task involves a comprehensive migration of the entire landing page and its supporting assets into the `bakery-landing` application. The primary   │
│ goal is to replicate the existing functionality and appearance with 1:1 parity by moving files to their new, designated locations within the Nx        │
│ monorepo structure. The migration should follow these steps and mappings:                                                                              │
│                                                                                                                                                        │
│ **1. Infrastructure Migration (Theme, Context, Utilities):**                                                                                           │
│ - Migrate core providers and configuration files to establish the application's foundation.                                                            │
│ - `ThemeRegistry.tsx` -> `apps/bakery-landing/src/components/providers/ThemeRegistry.tsx`                                                              │
│ - `ThemeContext.tsx` -> `apps/bakery-landing/src/context/ThemeContext.tsx`                                                                             │
│ - `CartContext.tsx` -> `apps/bakery-landing/src/context/CartContext.tsx` (ensure integration with `libs/shop/cart`)                                    │
│ - `NotificationContext.tsx` -> `apps/bakery-landing/src/context/NotificationContext.tsx`                                                               │
│ - `theme.ts` -> `apps/bakery-landing/src/theme/theme.ts`                                                                                               │
│ - `AppConfig.ts` -> `apps/bakery-landing/src/config/AppConfig.ts`                                                                                      │
│ - `formatPrice.ts` -> `apps/bakery-landing/src/utils/formatPrice.ts`                                                                                   │
│ - `createEmotionCache.ts` -> `apps/bakery-landing/src/utils/createEmotionCache.ts`                                                                     │
│ - `fonts.ts` -> `apps/bakery-landing/src/config/fonts.ts`                                                                                              │
│                                                                                                                                                        │
│ **2. Icon & Brand System Migration:**                                                                                                                  │
│ - Transfer all brand, social, and utility icons to ensure consistent branding.                                                                         │
│ - `Heusser.tsx`, `Divider.tsx`, `H.tsx` -> `apps/bakery-landing/src/components/icons/brand/`                                                           │
│ - Social icons (Facebook, Instagram, etc.) -> `apps/bakery-landing/src/components/icons/socials/`                                                      │
│ - Utility icons (Message, Phone, User) -> `apps/bakery-landing/src/components/icons/`                                                                  │
│                                                                                                                                                        │
│ **3. Layout & Core Component Migration:**                                                                                                              │
│ - Reconstruct the main application layout by migrating the Header and Footer components.                                                               │
│ - Merge `/src/app/(user)/layout.tsx` and `/src/app/layout.tsx` into `apps/bakery-landing/src/app/layout.tsx`.                                          │
│ - Migrate Header and all its sub-components to `apps/bakery-landing/src/components/header/`.                                                           │
│ - Migrate Footer and all its sub-components to `apps/bakery-landing/src/components/footer/`.                                                           │
│                                                                                                                                                        │
│ **4. Page Content Migration & Enhancement:**                                                                                                           │
│ - Migrate and enhance all landing page sections and static pages.                                                                                      │
│ - Replicate the structure of `/src/app/(user)/page.tsx` in `apps/bakery-landing/src/app/page.tsx`.                                                     │
│ - Enhance existing home page components (`InstagramFeed`, `TrustBadges`, `QuickOrder`, `SeasonalHighlights`) with logic from the old source.           │
│ - Migrate/enhance `about`, `imprint`, and the `news` pages (list and detail views).                                                                    │
│                                                                                                                                                        │
│ **5. Stylesheets:**                                                                                                                                    │
│ - Merge styles from `/src/app/globals.css` into `apps/bakery-landing/src/app/global.css`, resolving any conflicts.
