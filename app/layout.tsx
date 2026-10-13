import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Solakon Calendar Links',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Minimal shared root. Styles live in the route groups: (public) uses plain CSS that works in old
// in-app browsers, (admin) uses Tailwind. Language is set per page on a wrapper element.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
