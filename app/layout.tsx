import type { Metadata } from 'next'
import './globals.css'
import { Inter, JetBrains_Mono, Oswald } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
const oswald = Oswald({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Imposter',
  description: 'A party game about your friend group',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${mono.variable} ${oswald.variable} font-sans`}>{children}</body>
    </html>
  )
}

