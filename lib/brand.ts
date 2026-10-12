// Solakon brand colors for places that can't use CSS (Clerk's sign-in theme).
// Values from the Solakon color guidelines.
export const BRAND = {
  yellow400: '#FFCA22',
  gray800: '#212121',
  gray600: '#4E4E4E',
  gray300: '#D3D3D3',
  white: '#FFFFFF',
  blue600: '#1A4FFF',
  red700: '#B91C1C',
} as const;

export const clerkAppearance = {
  variables: {
    colorPrimary: BRAND.yellow400,
    colorPrimaryForeground: BRAND.gray800, // never white on yellow
    colorForeground: BRAND.gray800,
    colorMutedForeground: BRAND.gray600,
    colorBackground: BRAND.white,
    colorInput: BRAND.white,
    colorInputForeground: BRAND.gray800,
    colorBorder: BRAND.gray300,
    colorRing: BRAND.blue600,
    colorDanger: BRAND.red700,
    borderRadius: '0.5rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
};
