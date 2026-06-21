import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Velnor",
    template: "%s  - Velnor",
  },
  description: "Your wealth, in motion. Portfolio tracking, valuation tools, and market intelligence for investors.",
  openGraph: {
    title: "Velnor",
    description: "Your wealth, in motion.",
    siteName: "Velnor",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} dark`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
