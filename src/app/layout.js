import Script from 'next/script';
import Header from '@/components/header';
import HydrateStores from '@/components/hydrate-stores';
import RealtimeAlertListener from '@/components/siren/realtime-alert-listener';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'Radar - Israeli Emergency Alert Dashboard',
  description:
    'Real-time analytics and statistics for Israeli emergency alerts powered by the Siren system.',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <HydrateStores />
        <Script
          src="https://tracking.orielhaim.com/api/script.js"
          data-site-id="c37b67b31281"
          strategy="afterInteractive"
        />
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
        <RealtimeAlertListener />
      </body>
    </html>
  );
}
