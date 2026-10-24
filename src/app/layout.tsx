import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'IPOLENS — Production Ready IPO Intelligence & Portfolio Platform',
  description:
    'Live NSE India exchange feeds, real-time bidding demand curves, category subscription telemetry, SEBI-compliant family PAN application management, 1-click registrar allotment verification, and credential-free demat portfolio tracking.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#060913] text-slate-100 font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
