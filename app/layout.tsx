import type { Metadata } from 'next'
import { LiveBackdrop } from './components/LiveBackdrop'
import './globals.css'

export const metadata: Metadata = {
  applicationName: 'Find The Traitor',
  title: {
    default: 'Find The Traitor | Online Multiplayer Social Deduction Game',
    template: '%s | Find The Traitor',
  },
  description:
    'Play Find The Traitor, a dark online multiplayer social deduction party game where friends create private rooms, answer secret questions, discuss clues, vote, and reveal the hidden traitor.',
  keywords: [
    'Find The Traitor',
    'Find The Traitor game',
    'best multiplayer party game',
    'multiplayer party game online',
    'online party game',
    'online multiplayer game with friends',
    'spy party game',
    'spy game online',
    'social deduction game',
    'social deduction party game',
    'traitor game online',
    'multiplayer traitor game',
    'imposter game online',
    'browser party game',
    'no download multiplayer game',
    'play with friends online',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'Find The Traitor | Online Multiplayer Social Deduction Game',
    description:
      'Create a private room, invite friends, answer secret questions, discuss suspicious clues, vote, and expose the hidden traitor in a dark spy-themed browser game.',
    type: 'website',
    siteName: 'Find The Traitor',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find The Traitor | Play Online With Friends',
    description:
      'A dark online multiplayer spy party game for friends, parties, classrooms, Discord calls, and quick browser play.',
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  category: 'game',
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

