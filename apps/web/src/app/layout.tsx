import type { Metadata } from "next";
import "./globals.css";

/* Dana is self-hosted from public/fonts (see app/fonts.css). Only the cuts the
   UI actually leans on are preloaded; the rest of the family loads on demand. */
const PRELOADED_FONTS = [
  "/fonts/dana-regular.woff2",
  "/fonts/dana-medium.woff2",
  "/fonts/dana-demibold.woff2",
];

export const metadata: Metadata = {
  title: "KPI Tree Intelligence",
  description:
    "Turn a product description into a structured, AI-critiqued KPI tree.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
