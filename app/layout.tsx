import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BVG View',
  description: 'Track departures from multiple stations in Berlin\'s public transport network. Always know when your next train, tram, or bus is coming without using Google Maps. In comparison to the official BVG app, BVG View can display several stations at the same time.',
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
