import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#070e17',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'EcoNavigators - Marine Environmental Intelligence',
  description: 'Satellite imagery and vessel AIS tracking to trace marine oil-spill origins and build regulatory investigation trails.',
  keywords: [
    'EcoNavigators',
    'marine oil spill',
    'satellite imagery',
    'SAR radar',
    'AIS tracking',
    'drift trajectory',
    'ocean environmental intelligence',
  ],
  authors: [{ name: 'EcoNavigators Team' }],
  openGraph: {
    title: 'EcoNavigators - Marine Environmental Intelligence',
    description: 'Detect. Track. Trace. Protect. Satellite and vessel intelligence for marine oil-spill investigation.',
    url: 'https://econavigators.com',
    siteName: 'EcoNavigators',
    locale: 'en_US',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
