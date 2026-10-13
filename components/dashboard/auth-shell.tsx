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

/** Split layout for sign-in, sign-up and no-access: illustrated brand panel (left on large screens, top on mobile) with a glass card. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col lg:grid lg:grid-cols-[5fr_6fr]">
      <aside className="relative isolate flex flex-col gap-8 overflow-hidden bg-sidebar p-6 text-sidebar-foreground sm:p-10 lg:justify-between">
        <Image src="/auth-illustration.svg" alt="" fill priority unoptimized className="-z-10 object-cover" />
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-auto" />
          <span className="text-sm text-sidebar-foreground/70">Calendar Links</span>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl border border-sk-white/20 bg-sk-white/10 p-6 shadow-2xl ring-1 ring-sk-black/20 ring-inset backdrop-blur-xl backdrop-saturate-150 [box-shadow:inset_0_1px_0_rgb(255_255_255/0.35),0_24px_48px_-12px_rgb(0_0_0/0.6)] sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">One link per event. The right calendar on every device.</h1>
          <ul className="flex flex-col gap-4 text-sm">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sk-white/10 text-sidebar-foreground ring-1 ring-sk-white/20">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-sidebar-foreground/70 lg:block">Staff access only</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-4 py-10 sm:p-8">{children}</main>
    </div>
  );
}
