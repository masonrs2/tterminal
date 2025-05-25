import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TTerminal - Professional Trading Terminal',
  description: 'Ultra-fast trading terminal with real-time data and advanced charting',
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
