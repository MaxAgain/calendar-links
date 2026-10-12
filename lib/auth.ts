// Dashboard access: signed in with Clerk AND a verified email on an allowed domain (default solakon.de).
// Clerk's own allowlist is a paid feature, so the domain check lives here and runs on every
// dashboard page and every server action.
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
}

export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || 'solakon.de')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = String(email || '').toLowerCase().split('@')[1];
  return Boolean(domain) && allowedDomains().includes(domain);
}

type Lookup = { user: StaffUser; reason: null } | { user: null; reason: 'signed_out' | 'not_allowed' };

async function lookupStaffUser(): Promise<Lookup> {
  const { userId } = await auth();
  if (!userId) return { user: null, reason: 'signed_out' };
  const user = await currentUser();
  const primary = user?.primaryEmailAddress;
  const email = primary?.emailAddress?.toLowerCase() ?? '';
  if (!user || primary?.verification?.status !== 'verified' || !isAllowedEmail(email)) {
    return { user: null, reason: 'not_allowed' };
  }
  return { user: { id: user.id, email, name: user.fullName || email }, reason: null };
}

/** For pages: redirects to sign-in or to the "no access" page. */
export async function requireStaffPage(): Promise<StaffUser> {
  const result = await lookupStaffUser();
  if (!result.user) redirect(result.reason === 'signed_out' ? '/sign-in' : '/no-access');
  return result.user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireStaffAction(): Promise<StaffUser> {
  const result = await lookupStaffUser();
  if (!result.user) throw new Error('Not allowed. Please sign in with your solakon.de Google account.');
  return result.user;
}
