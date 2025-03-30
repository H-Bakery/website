// src/app/layout.tsx
import { AppConfig } from '../utils/AppConfig'
import ThemeRegistry from './ThemeRegistry'

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
      </head>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
