import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import { RainbowInit } from "@/components/rainbow-init";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { copy } from "@/lib/copy";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${copy.app.name} — ${copy.app.tagline}`,
    template: `%s · ${copy.app.name}`,
  },
  description: copy.app.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: copy.app.name,
    statusBarStyle: "default",
  },
  // Favicon + apple icon come from app/icon.png and app/apple-icon.png.
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        <PwaRegister />
        <RainbowInit />
      </body>
    </html>
  );
}
