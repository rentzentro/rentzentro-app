import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "RentZentro – Rent payments. Centralized.",
  description:
    "A modern platform for landlords to track units, tenants, rent—and accept online payments through Stripe. Simple enough for one unit, powerful enough for portfolios.",
  icons: {
    icon: "/favicon.png",                 // Browser tab icon
    shortcut: "/favicon.png",             // Backup icon
    apple: "/apple-touch-icon.png",       // iPhone/iPad home screen icon
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
