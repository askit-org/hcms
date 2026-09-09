import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppProvider from '@/components/AppProvider';
import ToastContainer from '@/components/Toast';
import PwaRegister from '@/components/PwaRegister';
import PwaInstallBanner from '@/components/PwaInstallBanner';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "HCMS — Hospital & Clinic Management System by Askit Studio",
  description: "Offline-ready Hospital & Clinic Management System for patient records, OPD management, and prescriptions by Askit Studio.",
  applicationName: "HCMS by Askit Studio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HCMS by Askit Studio",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <AppProvider>
          {children}
          <ToastContainer />
          <PwaRegister />
          <PwaInstallBanner />
        </AppProvider>
      </body>
    </html>
  );
}

