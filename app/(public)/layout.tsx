import type { Metadata } from 'next';
import { BRAND_URL } from '@/lib/site';
import './landing.css';

export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="band">
        <div className="band__inner">
          {/* Replace with the logo once available: <img src="/logo-white.svg" alt="Solakon" /> */}
          <a className="wordmark" href={BRAND_URL}>SOLAKON</a>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
