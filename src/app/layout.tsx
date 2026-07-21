import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import PWA from "@/components/PWA";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#060b18",
};

export const metadata: Metadata = {
  title: "Logistica Hogareno",
  description: "Sistema de gestion logistica de deposito",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Logística",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="h-full antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <PWA />
      </body>
    </html>
  );
}
