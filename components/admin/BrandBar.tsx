import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function BrandBar({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-sk-gray-800 text-sk-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-3 text-sk-white no-underline">
          <Image src="/solakon-logo-white.png" alt="Solakon" width={434} height={96} className="h-6 w-auto" loading="eager" unoptimized />
          <span className="text-sm text-sk-gray-300">Calendar Links</span>
        </Link>
        {children}
      </div>
    </header>
  );
}
