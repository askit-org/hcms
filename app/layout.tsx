import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppProvider from '@/components/AppProvider';
import ToastContainer from '@/components/Toast';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HCMS — Hospital & Clinic Management System",
  description: "Offline OPD management system for fast patient entry, follow-up tracking, and prescription management.",
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
        </AppProvider>
      </body>
    </html>
  );
}
