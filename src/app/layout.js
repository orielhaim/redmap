import Header from '@/components/header';
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

export const metadata = {
  title: 'RedMap - Israeli Emergency Alert Dashboard',
  description:
    'Real-time analytics and statistics for Israeli emergency alerts powered by the RedAlert API.',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
