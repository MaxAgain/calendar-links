import { ClerkProvider } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/brand';
import './globals.css';

// Clerk is loaded only for the dashboard — never on recipient pages.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} signInUrl="/sign-in" signInFallbackRedirectUrl="/dashboard" afterSignOutUrl="/sign-in">
      <div lang="en" className="flex min-h-screen flex-col">
        {children}
      </div>
    </ClerkProvider>
  );
}
