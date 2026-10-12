'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Events', match: (p: string) => p === '/dashboard' || p.startsWith('/dashboard/events') },
  { href: '/dashboard/integrations', label: 'Google Sheet', match: (p: string) => p.startsWith('/dashboard/integrations') },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold no-underline ${active ? 'bg-sk-gray-700 text-sk-white' : 'text-sk-gray-300 hover:bg-sk-gray-700 hover:text-sk-white'}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
