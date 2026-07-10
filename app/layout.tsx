import type { Metadata } from 'next'
import { LiveBackdrop } from './components/LiveBackdrop'
import './globals.css'

export const metadata: Metadata = {
  title: 'Find The Traitor',
  description: 'A dark social deduction party game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LiveBackdrop />
        {children}
      </body>
    </html>
  )
}
