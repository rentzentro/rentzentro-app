// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

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
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-slate-950 text-slate-50">
        {children}

        {/* Global footer */}
        <footer className="border-t border-slate-900 mt-16">
          <div className="mx-auto max-w-6xl px-4 py-10 text-[11px] text-slate-400">
            <div className="flex flex-col gap-6 md:flex-row md:justify-between">
              {/* Left */}
              <div className="space-y-2">
                <p className="font-semibold text-slate-200">RentZentro</p>
                <p>
                  RentZentro is software for landlords — not a property management company.
                </p>

                <p className="text-[10px] text-slate-500">
                  Mobile apps coming soon
                </p>

                {/* App store badges (disabled) */}
                <div className="mt-2 flex gap-3 opacity-50 cursor-not-allowed">
                  <img
                    src="/appstore-badge.svg"
                    alt="Download on the App Store (coming soon)"
                    className="h-9"
                  />
                  <img
                    src="/googleplay-badge.svg"
                    alt="Get it on Google Play (coming soon)"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Right */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-4">
                  <Link href="/terms" className="hover:text-emerald-300 hover:underline">
                    Terms of Service
                  </Link>
                  <Link href="/privacy" className="hover:text-emerald-300 hover:underline">
                    Privacy Policy
                  </Link>
                  <a
                    href="mailto:info@rentzentro.com"
                    className="hover:text-emerald-300 hover:underline"
                  >
                    info@rentzentro.com
                  </a>
                </div>

                {/* Social icons */}
                <div className="flex items-center gap-4 text-slate-300">
                  <a href="https://facebook.com" aria-label="Facebook">Facebook</a>
                  <a href="https://instagram.com" aria-label="Instagram">Instagram</a>
                  <a href="https://twitter.com" aria-label="Twitter">X</a>
                  <a href="https://linkedin.com" aria-label="LinkedIn">LinkedIn</a>
                  <a href="https://tiktok.com" aria-label="TikTok">TikTok</a>
                </div>
              </div>
            </div>

            <div className="mt-8 text-[10px] text-slate-500">
              © {new Date().getFullYear()} RentZentro. All rights reserved.
              <br />
              Stripe-powered payments · Secure by design
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
