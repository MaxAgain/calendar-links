import { EyeOffIcon, SheetIcon, SmartphoneIcon, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';

const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: SmartphoneIcon, text: 'Detects the device and opens the right calendar' },
  { icon: EyeOffIcon, text: 'Anonymous tracking, no emails or IP addresses' },
  { icon: SheetIcon, text: 'Every click synced to Google Sheets' },
];

function Logo({ className }: { className?: string }) {
  return <Image src="/solakon-logo-white.png" alt="Solakon" width={434} height={96} unoptimized className={className} />;
}

/** Split layout for sign-in, sign-up and no-access: dark brand panel on large screens, compact dark bar on mobile. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col lg:grid lg:grid-cols-[5fr_6fr]">
      <header className="flex h-14 shrink-0 items-center gap-3 bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <Logo className="h-5 w-auto" />
        <span className="text-sm text-sidebar-foreground/70">Calendar Links</span>
      </header>

      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-auto" />
          <span className="text-sm text-sidebar-foreground/70">Calendar Links</span>
        </div>
        <div className="flex max-w-md flex-col gap-8">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">One link per event. The right calendar on every device.</h1>
          <ul className="flex flex-col gap-4 text-sm">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/70">Staff access only</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-4 py-10 sm:p-8">{children}</main>
    </div>
  );
}
