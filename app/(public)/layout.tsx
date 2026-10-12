import type { Metadata } from 'next';
import Image from 'next/image';
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
          <a className="wordmark" href={BRAND_URL}>
            <Image src="/solakon-logo-white.png" alt="Solakon" width={434} height={96} loading="eager" unoptimized />
          </a>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
