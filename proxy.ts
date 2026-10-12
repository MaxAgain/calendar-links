import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isAuthRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

// Clerk runs ONLY on dashboard routes. Recipient pages (/e/…), the tracking endpoint and the
// cron job stay free of Clerk scripts, redirects and cookies.
// /__clerk is Clerk's Frontend API proxy (production keys on *.vercel.app); it is handled
// before the callback, so auth.protect() never runs on it.
// The solakon.de domain check happens in lib/auth.ts on every page and server action.
export default clerkMiddleware(
  async (auth, req) => {
    if (!isAuthRoute(req)) await auth.protect();
  },
  { signInUrl: '/sign-in', signUpUrl: '/sign-up' },
);

export const config = {
  matcher: ['/', '/dashboard/:path*', '/sign-in/:path*', '/sign-up/:path*', '/no-access', '/__clerk/:path*'],
};
