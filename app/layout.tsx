import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://bvg-view.netlify.app/'),
  title: 'BVG View',
  description: 'Track departures from multiple stations in Berlin\'s public transport network. Always know when your next train, tram, or bus is coming without using Google Maps. In comparison to the official BVG app, BVG View can display several stations at the same time.',
  openGraph: {
    title: 'BVG View - digital departure board for Berlin\'s public transport',
    description: 'Track departures from multiple stations in Berlin\'s public transport network. Always know when your next train, tram, or bus is coming without using Google Maps. In comparison to the official BVG app, BVG View can display several stations at the same time.',
    images: ['opengraph-image.png']
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BVG View - digital departure board for Berlin\'s public transport',
    description: 'Track departures from multiple stations in Berlin\'s public transport network. Always know when your next train, tram, or bus is coming without using Google Maps. In comparison to the official BVG app, BVG View can display several stations at the same time.',
    images: ['twitter-image.png']
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
