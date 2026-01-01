// app/layout.tsx
import './globals.css';
import Link from 'next/link';
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
  alternates: { canonical: '/' },

  // ✅ PWA manifest
  manifest: '/manifest.json',

  // ✅ iOS web-app settings (helps “Add to Home Screen” / wrappers)
  appleWebApp: {
    capable: true,
    title: 'RentZentro',
    statusBarStyle: 'black-translucent',
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

// No Viewport typing (prevents the red underline in some Next typings)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1220',
};

function SocialIcon({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950/60 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200"
    >
      {children}
    </a>
  );
}

function StoreBadge({ label, src }: { label: string; src: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 opacity-60"
      aria-label={label}
      title="Coming soon"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="h-9 w-auto" loading="lazy" />
      <span className="text-[11px] font-semibold text-slate-300">
        Coming soon
      </span>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Left */}
          <div>
            <p className="text-sm font-semibold text-slate-50">RentZentro</p>
            <p className="mt-2 text-[12px] text-slate-400">
              RentZentro is software for landlords — not a property management
              company.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/terms"
                className="text-[12px] text-slate-400 hover:text-emerald-200 hover:underline"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="text-[12px] text-slate-400 hover:text-emerald-200 hover:underline"
              >
                Privacy Policy
              </Link>
              <a
                href="mailto:info@rentzentro.com"
                className="text-[12px] text-slate-400 hover:text-emerald-200 hover:underline"
              >
                info@rentzentro.com
              </a>
            </div>
          </div>

          {/* Middle: Social */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Follow
            </p>

            <div className="mt-3 flex flex-wrap gap-3">
              {/* Facebook */}
              <SocialIcon
                label="RentZentro on Facebook"
                href="https://www.facebook.com/share/17VhDVmSnx/?mibextid=wwXIfr"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.88h-2.34v6.99A10 10 0 0 0 22 12Z" />
                </svg>
              </SocialIcon>

              {/* Instagram */}
              <SocialIcon
                label="RentZentro on Instagram"
                href="https://www.instagram.com/rentzentro/"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm10.25 1.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                </svg>
              </SocialIcon>

              {/* TikTok */}
              <SocialIcon
                label="RentZentro on TikTok"
                href="https://www.tiktok.com/@rentzentro?_r=1&_t=ZP-92Hm9mFF4cZ"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M16 3c.4 3.2 2.6 5.4 5 5.7v3.1c-1.9-.1-3.6-.7-5-1.8v6.9c0 3.4-2.8 6.1-6.2 6.1S3.6 20.3 3.6 16.9c0-3.4 2.8-6.1 6.2-6.1.5 0 1 .1 1.5.2v3.3c-.5-.2-1-.3-1.5-.3-1.7 0-3.1 1.3-3.1 2.9s1.4 2.9 3.1 2.9 3.1-1.3 3.1-2.9V3h3.1Z" />
                </svg>
              </SocialIcon>

              {/* Optional placeholders (keep for later) */}
              <SocialIcon label="RentZentro on X (coming soon)" href="#">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.9 2H22l-6.8 7.8L23 22h-6.7l-5.2-6.7L5.3 22H2l7.3-8.4L1 2h6.9l4.7 6.1L18.9 2Zm-1.2 18h1.8L7.2 4H5.3l12.4 16Z" />
                </svg>
              </SocialIcon>

              <SocialIcon label="RentZentro on LinkedIn (coming soon)" href="#">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.94 6.5A2.19 2.19 0 1 1 7 2.12a2.19 2.19 0 0 1-.06 4.38ZM4.75 21.5h4.39V8.5H4.75v13ZM11.25 8.5h4.2v1.78h.06c.59-1.12 2.04-2.3 4.2-2.3 4.49 0 5.31 2.84 5.31 6.54v7h-4.39v-6.2c0-1.48-.03-3.38-2.16-3.38-2.16 0-2.49 1.62-2.49 3.27v6.31h-4.53V8.5Z" />
                </svg>
              </SocialIcon>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Social links open in a new tab.
            </p>
          </div>

          {/* Right: Apps */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mobile apps
            </p>
            <p className="mt-2 text-[12px] text-slate-400">
              Mobile apps coming soon.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StoreBadge
                label="Download on the App Store"
                src="/badges/app-store.svg"
              />
              <StoreBadge
                label="Get it on Google Play"
                src="/badges/google-play.svg"
              />
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Buttons are disabled until the apps are approved and live.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-5 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} RentZentro. All rights reserved.</p>
          <p>Stripe-powered payments · Secure by design</p>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Explicit links (helps wrappers + avoids “missing manifest” issues) */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-50">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
