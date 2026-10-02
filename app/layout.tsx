import type { Metadata } from "next";
import "./globals.css";
import './flight.css';

export const metadata: Metadata = {
  title: "Hinode — Dawn Wing",
  description: "A cooperative flight adventure over six real Japanese landscapes. Two pilots, twelve missions, one signal to carry home.",
  metadataBase: new URL('https://lantern-relay-ten.vercel.app'),
  openGraph: {
    title: 'Hinode — Dawn Wing',
    description: 'Two pilots. Six real Japanese landscapes. Carry the dawn home together.',
    images: [{ url: '/flight/terrain/fuji.webp', width: 2048, height: 2048, alt: 'Real aerial photography of Mount Fuji' }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
