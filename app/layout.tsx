import type { Metadata } from "next";
import "./globals.css";
import "./adventure.css";
import "./cinematic.css";
import "./expedition.css";

export const metadata: Metadata = {
  title: "Lantern Relay: The Lost Dawn",
  description: "An illustrated cooperative adventure for two. Explore sixteen Japanese landscapes, restore the crossings, and bring the dawn home together.",
  metadataBase: new URL('https://lantern-relay-ten.vercel.app'),
  openGraph: {
    title: 'Lantern Relay: The Lost Dawn',
    description: 'Two lanterns. Sixteen landscapes. An adventure you can only complete together.',
    images: [{ url: '/adventure/valley.png', width: 1536, height: 1024, alt: 'A lantern-lit mountain village beneath the moon' }],
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
