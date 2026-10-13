import type { ComponentProps } from 'react';
import type { ClerkProvider } from '@clerk/nextjs';

type ClerkAppearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>;

// Clerk's own components follow the dashboard theme because every value is a CSS variable from globals.css.
// They change with the `dark` class on <html>, with no re-render. The font is inherited from the page.
// Clerk draws text links in the primary colour. Yellow is never used as text on light surfaces, so links use
// the dashboard link colour instead (blue, lighter in dark mode).
const linkStyle = { color: 'var(--link)' };

export const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--primary)',
    colorPrimaryForeground: 'var(--primary-foreground)', // dark text on yellow, never white
    colorForeground: 'var(--foreground)',
    colorMutedForeground: 'var(--muted-foreground)',
    colorBackground: 'var(--card)',
    colorInput: 'var(--background)',
    colorInputForeground: 'var(--foreground)',
    colorBorder: 'var(--border)',
    colorRing: 'var(--ring)',
    colorDanger: 'var(--destructive)',
    colorNeutral: 'var(--foreground)',
    colorModalBackdrop: 'var(--color-sk-gray-950)',
    borderRadius: 'var(--radius)',
  },
  elements: {
    footerActionLink: linkStyle,
    formFieldAction: linkStyle,
    formResendCodeLink: linkStyle,
    identityPreviewEditButton: linkStyle,
    backLink: linkStyle,
  },
} satisfies ClerkAppearance;
