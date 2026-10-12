// Monochrome line icons (stroke = currentColor). Deliberately generic: no third-party brand logos.
import type { ReactNode } from 'react';
import type { CalendarId } from '@/lib/calendar';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const CalendarIcon = () => <Svg><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Svg>;
export const CalendarPlusIcon = () => <Svg><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v6M9 15.5h6" /></Svg>;
export const GlobeIcon = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Svg>;
export const DownloadIcon = () => <Svg><path d="M12 3v12M7 10l5 5 5-5M4 19.5h16" /></Svg>;
export const ClockIcon = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const PinIcon = () => <Svg><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
export const LinkIcon = () => <Svg><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></Svg>;
export const CopyIcon = () => <Svg><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></Svg>;
export const CheckIcon = () => <Svg><path d="M4.5 12.5l5 5 10-11" /></Svg>;
export const InfoIcon = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></Svg>;

export function CalendarButtonIcon({ calendar }: { calendar: CalendarId }) {
  if (calendar === 'apple' || calendar === 'outlook') return <CalendarPlusIcon />;
  if (calendar === 'ics') return <DownloadIcon />;
  return <GlobeIcon />;
}
