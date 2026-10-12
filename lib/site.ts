// Public, non-secret settings.

export const BRAND_NAME = 'Solakon';
export const BRAND_URL = 'https://solakon.de';
export const APP_VERSION = '2.0.0';
export const DEFAULT_TIMEZONE = 'Europe/Berlin';

/** Part of every event's iCalendar UID. Never change it after the first event is published. */
export const UID_DOMAIN = 'cal.solakon.de';

/**
 * Base URL for links that go into emails. Always the production address, so links copied
 * from a preview deployment still point to production.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  return 'http://localhost:3000';
}

export const eventPath = (id: string) => `/e/${id}`;
export const eventLink = (id: string) => `${siteUrl()}${eventPath(id)}`;
