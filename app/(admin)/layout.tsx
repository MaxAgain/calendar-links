import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import { clerkAppearance } from '@/components/dashboard/clerk-appearance';
import { ThemeProvider } from '@/components/dashboard/theme/theme-provider';
import { ThemeScript } from '@/components/dashboard/theme/theme-script';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

// Clerk is loaded only for the dashboard — never on recipient pages.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
      {/*
        <html> is shared with the recipient pages, so the fonts are exposed as CSS variables on :root through a
        hoisted <style> instead of classes on <html>. Popups (portals) inherit them too.
      */}
      <style href="sk-admin-fonts" precedence="medium">
        {`:root{--font-geist-sans:${geistSans.style.fontFamily};--font-geist-mono:${geistMono.style.fontFamily}}`}
      </style>
      <ThemeScript />
      <ThemeProvider>
        <TooltipProvider>
          <div lang="en" className="min-h-svh">
            {children}
          </div>
        </TooltipProvider>
        <Toaster />
      </ThemeProvider>
    </ClerkProvider>
  );
}
