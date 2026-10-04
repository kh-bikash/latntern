import type { Metadata } from "next";
import "./globals.css";
import 'maplibre-gl/dist/maplibre-gl.css';
import './flight.css';
import './world.css';
import './sim.css';

export const metadata: Metadata = {
  title: "Hinode — Flight Simulator",
  description: "A browser flight simulator: 6-DOF flight model and live weather, air traffic and ATC over photogrammetry 3D scenery of Cologne, Düsseldorf, the Ruhr and Strasbourg, in an Airbus A320 with a modelled flight deck.",
  metadataBase: new URL('https://lantern-relay-ten.vercel.app'),
  openGraph: {
    title: 'Hinode — Flight Simulator',
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
