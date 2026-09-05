import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YHCT Social · Admin Control Center',
  description: 'Trung tâm điều hành độc lập YHCT Social v2.0',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
