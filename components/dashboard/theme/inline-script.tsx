'use client';

// Inline script helper from the Next.js docs (guides/preventing-flash-before-hydration): the script runs
// during HTML parsing on full page loads. On the client it is rendered as text/plain, so React does not warn
// about <script> tags and the script never runs twice. `suppressHydrationWarning` covers the type mismatch.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
