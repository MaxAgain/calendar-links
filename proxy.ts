import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isSignInRoute = createRouteMatcher(['/sign-in(.*)']);

// Clerk runs ONLY on dashboard routes. Recipient pages (/e/…), the tracking endpoint and the
// cron job stay free of Clerk scripts, redirects and cookies.
// The solakon.de domain check happens in lib/auth.ts on every page and server action.
export default clerkMiddleware(
  async (auth, req) => {
    if (!isSignInRoute(req)) await auth.protect();
  },
  { signInUrl: '/sign-in' },
);

export const config = {
  matcher: ['/', '/dashboard/:path*', '/sign-in/:path*', '/no-access'],
};
