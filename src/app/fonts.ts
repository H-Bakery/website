import { Ubuntu, Averia_Serif_Libre } from 'next/font/google'

export const ubuntu = Ubuntu({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ubuntu',
})

export const averiaSerifLibre = Averia_Serif_Libre({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-averia',
})
