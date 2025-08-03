# Layout Components

Header and footer components for consistent site layout across the bakery application.

## Header Components

### Header

Main navigation header with responsive behavior.

```tsx
import { Header } from '@bakery/shared/ui'

;<Header
  logo={<HeusserLogo />}
  navigation={navigationItems}
  showCart
  showAuth
/>
```

### HeaderItem

Individual navigation item for the header.

```tsx
import { HeaderItem } from '@bakery/shared/ui'

;<HeaderItem href="/products" label="Products" />
```

### HamburgerMenu

Mobile hamburger menu button.

```tsx
import { HamburgerMenu } from '@bakery/shared/ui'

;<HamburgerMenu isOpen={mobileMenuOpen} onClick={toggleMobileMenu} />
```

### MobileHeaderModal

Full-screen mobile navigation modal.

```tsx
import { MobileHeaderModal } from '@bakery/shared/ui'

;<MobileHeaderModal
  isOpen={mobileMenuOpen}
  onClose={closeMobileMenu}
  navigation={navigationItems}
/>
```

## Footer Components

### Footer

Main footer with contact info, links, and opening hours.

```tsx
import { Footer } from '@bakery/shared/ui'

;<Footer
  contact={contactInfo}
  links={footerLinks}
  openingHours={hours}
  social={socialLinks}
/>
```

### FooterContact

Contact information section.

```tsx
import { FooterContact } from '@bakery/shared/ui'

;<FooterContact
  address="Muster Straße 123"
  phone="+41 xx xxx xx xx"
  email="info@baeckerei-heusser.ch"
/>
```

### FooterMenu

Navigation menu for the footer.

```tsx
import { FooterMenu } from '@bakery/shared/ui'

;<FooterMenu title="Quick Links" links={quickLinks} />
```

### FooterOpenings

Opening hours display.

```tsx
import { FooterOpenings } from '@bakery/shared/ui'

;<FooterOpenings hours={operatingHours} timezone="Europe/Zurich" />
```

## Layout Best Practices

- Use consistent spacing and alignment
- Ensure mobile responsiveness
- Follow accessibility guidelines
- Maintain brand consistency across all layout components
