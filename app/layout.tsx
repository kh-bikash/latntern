import type { Metadata } from "next";
import "./globals.css";
import './flight.css';
import './world.css';

export const metadata: Metadata = {
  title: "Hinode — World Flight",
  description: "Plan worldwide flights, taxi, take off and land together. Open global terrain and a six-region Japanese expedition.",
  metadataBase: new URL('https://lantern-relay-ten.vercel.app'),
  openGraph: {
    title: 'Hinode — World Flight',
    description: 'Two pilots. Open skies. Plan your route and fly from runway to runway.',
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
      <head><link rel="stylesheet" href="/cesium/Widgets/widgets.css"/></head><body className="antialiased">{children}</body>
    </html>
  );
}
