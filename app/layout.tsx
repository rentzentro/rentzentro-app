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

// If “Viewport” is underlined red in YOUR setup, keep this untyped.
// Next will still use it.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1220',
};

const SOCIAL = {
  facebook: 'https://facebook.com/', // TODO: replace
  instagram: 'https://instagram.com/', // TODO: replace
  twitter: 'https://x.com/', // TODO: replace
  linkedin: 'https://linkedin.com/', // TODO: replace
  tiktok: 'https://tiktok.com/', // TODO: replace
};

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950/60 text-slate-200 hover:border-emerald-500/40 hover:text-emerald-200 transition"
    >
      {children}
    </a>
  );
}

function StoreBadge({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div
      aria-disabled="true"
      className="select-none opacity-40 grayscale"
      title="Coming soon"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-10 w-auto"
        draggable={false}
      />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950/40">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <span className="text-lg font-semibold text-emerald-400">RZ</span>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold tracking-tight text-slate-50">RentZentro</p>
                <p className="text-[11px] text-slate-400">
                  Software for landlords — not a property management company.
                </p>
              </div>
            </div>

            <p className="mt-3 max-w-sm text-[11px] text-slate-400">
              Rent collection (ACH + card), maintenance tracking, document sharing, listings, and e-sign — in one clean dashboard.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SocialIcon href={SOCIAL.facebook} label="RentZentro on Facebook">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.9l-.5 2.9h-2.4v7A10 10 0 0 0 22 12z" />
                </svg>
              </SocialIcon>

              <SocialIcon href={SOCIAL.instagram} label="RentZentro on Instagram">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 4.5A5.5 5.5 0 1 1 6.5 14 5.5 5.5 0 0 1 12 8.5zm0 2A3.5 3.5 0 1 0 15.5 14 3.5 3.5 0 0 0 12 10.5zM18 6.8a1.2 1.2 0 1 1-1.2-1.2A1.2 1.2 0 0 1 18 6.8z" />
                </svg>
              </SocialIcon>

              <SocialIcon href={SOCIAL.tiktok} label="RentZentro on TikTok">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M16 3c.6 2.5 2.4 4.2 5 4.4v3.1c-1.9 0-3.6-.6-5-1.7V16a6 6 0 1 1-6-6c.3 0 .6 0 .9.1v3.3a2.9 2.9 0 1 0 2.1 2.8V3h3z" />
                </svg>
              </SocialIcon>

              <SocialIcon href={SOCIAL.twitter} label="RentZentro on X">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M18.9 2H22l-6.8 7.8L23 22h-6.8l-5.3-6.8L4.9 22H2l7.3-8.4L1 2h7l4.8 6.1L18.9 2zm-1.2 18h1.7L7.1 3.9H5.3L17.7 20z" />
                </svg>
              </SocialIcon>

              <SocialIcon href={SOCIAL.linkedin} label="RentZentro on LinkedIn">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-.9 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6v6.2h-4v-5.5c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21h-4V9z" />
                </svg>
              </SocialIcon>
            </div>
          </div>

          {/* Store badges */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mobile apps
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Coming soon
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <StoreBadge src="/badges/app-store.svg" alt="Download on the App Store (coming soon)" />
              <StoreBadge src="/badges/google-play.svg" alt="Get it on Google Play (coming soon)" />
            </div>

            <p className="mt-3 text-[10px] text-slate-500">
              Buttons are disabled until the apps are live.
            </p>
          </div>

          {/* Links */}
          <div className="md:justify-self-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Company
            </p>

            <div className="mt-3 flex flex-col gap-2 text-[11px]">
              <Link href="/terms" className="text-slate-300 hover:text-emerald-200 hover:underline">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-slate-300 hover:text-emerald-200 hover:underline">
                Privacy Policy
              </Link>
              <a
                href="mailto:info@rentzentro.com"
                className="text-slate-300 hover:text-emerald-200 hover:underline"
              >
                info@rentzentro.com
              </a>
            </div>

            <p className="mt-5 text-[10px] text-slate-500">
              Stripe-powered payments · Secure by design
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-900 pt-4 text-[11px] text-slate-500">
          © {new Date().getFullYear()} RentZentro. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Extra safety for browsers that ignore injected icons */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-slate-950 text-slate-50">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
