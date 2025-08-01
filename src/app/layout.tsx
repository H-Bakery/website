// src/app/layout.tsx
import { AppConfig } from '../utils/AppConfig'
import ThemeRegistry from './ThemeRegistry'
import AuthWrapper from '../components/providers/AuthWrapper'
import './globals.css'

// This works because this file is now a Server Component
export const metadata = {
  title: AppConfig.title,
  description: AppConfig.description,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang={AppConfig.locale}>
      <head>
        <link
          rel="apple-touch-icon"
          href={`${process.env.basePath}/apple-touch-icon.png`}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={`${process.env.basePath}/favicon-32x32.png`}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={`${process.env.basePath}/favicon-16x16.png`}
        />
        <link rel="icon" href={`${process.env.basePath}/favicon.ico`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lora:wght@400;500;600&family=Ubuntu:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeRegistry>
          <AuthWrapper>
            {children}
          </AuthWrapper>
        </ThemeRegistry>
      </body>
    </html>
  )
}
