import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { ActivitySidebar } from '@/components/ActivitySidebar';

export const metadata: Metadata = {
  title: 'RunningHub Shots',
  description: 'Shot-based bulk image workflow tool powered by RunningHub',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100 antialiased">
        <SiteHeader />
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
          <ActivitySidebar />
        </div>
      </body>
    </html>
  );
}
