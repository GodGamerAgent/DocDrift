import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/Header';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DocDrift Studio — Swiss Architectural Atelier & Documentation Workbench',
  description:
    'Autonomous Code & Documentation Auditing with a Live Beginner Sandbox, Interactive 3D Spatial Stack, Side-by-Side Diff Viewer, Context Citations, and 1-Click GitHub PR Creator.',
  openGraph: {
    title: 'DocDrift Studio — Swiss Architectural Atelier & Documentation Workbench',
    description:
      'Autonomous Code & Documentation Auditing with a Live Beginner Sandbox, Interactive 3D Spatial Stack, Side-by-Side Diff Viewer, Context Citations, and 1-Click GitHub PR Creator.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
      data-theme="atelier"
      data-ui-mode="3d"
    >
      <body className="atelier-blueprint min-h-screen">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
