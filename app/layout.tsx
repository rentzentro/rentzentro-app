// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.rentzentro.com'),
  title: {
    default: 'RentZentro — Rent collection, listings & e-sign for landlords',
    template: '%s | RentZentro',
  },
  description:
    'RentZentro is software for landlords (not a property management company). Collect rent online (ACH + card), send rent reminders, manage maintenance requests, share documents, publish rental listings, and send leases for e-signatures.',
  applicationName: 'RentZentro',
  keywords: [
    'rent collection',
    'pay rent online',
    'landlord software',
    'tenant portal',
    'property management software',
    'maintenance requests',
    'rental listings',
    'lease e-signature',
    'online rent payments',
    'rent reminders',
  ],
  authors: [{ name: 'RentZentro' }],
  creator: 'RentZentro',
  publisher: 'RentZentro',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.rentzentro.com',
    siteName: 'RentZentro',
    title: 'RentZentro — Rent collection, listings & e-sign for landlords',
    description:
      'Collect rent online (ACH + card), manage tenants & maintenance, share documents, publish listings, and e-sign leases — all in one clean landlord dashboard.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RentZentro — Rent collection, listings & e-sign for landlords',
    description:
      'Collect rent online, manage tenants & maintenance, publish listings, and e-sign leases — all in one clean landlord dashboard.',
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

// Don’t type this as Viewport to avoid the red underline on older Next typings.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1220',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Extra safety for browsers that ignore injected icons */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
