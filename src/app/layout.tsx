import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Fonts are bundled with the app (the "geist" package), so no outside font service is needed.
export const metadata: Metadata = {
  title: "Nurse Mira",
  description: "Your Personal Nursing School Companion",
  applicationName: "Nurse Mira",
  appleWebApp: { capable: true, title: "Nurse Mira", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// Phone screens: follow the device width in portrait and landscape, allow zooming (accessibility),
// colour the browser bar, and keep content clear of notches.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2148c0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
