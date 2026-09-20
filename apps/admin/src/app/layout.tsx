import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LocaleProvider } from '@/i18n/client'
import { getLocale } from '@/i18n/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'botworks — Platform',
  description: 'botworks admin — tenant management, bot fleet, analytics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale()
  return (
    <html lang={locale}>
      <body className={inter.className}>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  )
}
