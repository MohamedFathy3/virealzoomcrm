import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Viral Zoom ERP',
  description: 'نظام تشغيل وكالة Viral Zoom للتسويق والإعلان',
  icons: { icon: '/viral-zoom.webp' }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
