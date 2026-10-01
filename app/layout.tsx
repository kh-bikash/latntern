import type { Metadata } from "next";
import "./globals.css";
import "./adventure.css";
import "./cinematic.css";
import "./expedition.css";

export const metadata: Metadata = {
  title: "Lantern Relay: The Lost Dawn",
  description: "An illustrated cooperative adventure for two. Explore sixteen Japanese landscapes, restore the crossings, and bring the dawn home together.",
  other: {
    "codex-preview": "development",
  },
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
