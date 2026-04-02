// dealiq/frontend/app/layout.js
// Root layout — wraps all pages

import { Sora } from 'next/font/google'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sora',
})

export const metadata = {
  title: { default: 'DealIQ', template: '%s — DealIQ' },
  description: 'AI deal workspace for B2B sales teams. Track buyers, automate follow-ups, close faster.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://dealiq.io'),
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="font-sora antialiased bg-bg text-ink">
        {children}
      </body>
    </html>
  )
}
