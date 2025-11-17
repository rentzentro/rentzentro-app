import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RentZentro – Simple Rent Payments',
  description:
    'RentZentro helps landlords and tenants track units, rent, and payments in one simple dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased bg-slate-950 text-slate-50`}
      >
        <div className="min-h-screen flex flex-col">
          {/* Top navigation / brand bar */}
          <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link
                href="/"
                className="text-sm font-semibold tracking-tight"
              >
                <span className="text-emerald-400">Rent</span>Zentro
              </Link>

              <nav className="flex items-center gap-3 text-xs text-slate-400">
                <Link
                  href="/landlord"
                  className="transition hover:text-emerald-400"
                >
                  Landlord
                </Link>
                <Link
                  href="/tenant"
                  className="transition hover:text-emerald-400"
                >
                  Tenant
                </Link>
              </nav>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
