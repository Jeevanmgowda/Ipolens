import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'IPOLENS — Production Ready IPO Intelligence & Portfolio Platform',
  description:
    'Live NSE India exchange feeds, real-time bidding demand curves, category subscription telemetry, SEBI-compliant family PAN application management, 1-click registrar allotment verification, and credential-free demat portfolio tracking.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#060913] text-slate-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
