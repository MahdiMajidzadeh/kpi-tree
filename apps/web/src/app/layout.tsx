import type { Metadata } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
});

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
      <body className={`${inter.variable} ${vazirmatn.variable}`}>
        {children}
      </body>
    </html>
  );
}
