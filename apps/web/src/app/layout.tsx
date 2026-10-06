import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { AppInitializer } from '@/components/layout/app-initializer';

export const metadata: Metadata = {
  title: 'AI Knowledge Workspace | Grounded Intelligence',
  description: 'Enterprise AI Workspace with Multi-Tenant Access Control and Grounded RAG Assistant',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full flex flex-col bg-[#0b0f19] text-slate-100 antialiased">
        <ToastProvider>
          <AppInitializer>{children}</AppInitializer>
        </ToastProvider>
      </body>
    </html>
  );
}
