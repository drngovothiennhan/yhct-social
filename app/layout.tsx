import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/providers/auth-provider';
import { HardwareModeProvider } from '@/components/providers/hardware-mode-provider';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'YHCT Social',
  title: 'Cộng đồng Y học Cổ truyền',
  description: 'Mạng xã hội chia sẻ học thuật, ca lâm sàng và kiến thức Y học Cổ truyền.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'YHCT Social',
  },
};

export const viewport: Viewport = {
  themeColor: '#245c45',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <HardwareModeProvider>
          <AuthProvider>{children}</AuthProvider>
        </HardwareModeProvider>
      </body>
    </html>
  );
}
