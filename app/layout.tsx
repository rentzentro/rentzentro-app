// app/layout.tsx

import './globals.css';

export const metadata = {
  title: "RentZentro — Simple rent collection for landlords",
  description: "Collect rent online. Manage tenants, properties, maintenance, and payments easily.",
  icons: {
    icon: '/favicon.png',               // Browser tab icon
    shortcut: '/favicon.png',           // Backup icon
    apple: '/apple-touch-icon.png',     // iOS home screen icon
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Extra safety for browsers that ignore Next metadata */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
