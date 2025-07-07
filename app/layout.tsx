import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TradeWiz - Real-time Trading Data Sorting',
  description: 'Real-time Stock Trading Data Sorting with Parallel Radix Sort',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
