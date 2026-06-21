import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`} style={{ ["--font-space-grotesk" as string]: "'Space Grotesk Variable', system-ui, sans-serif" }}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
