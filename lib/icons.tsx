// אייקונים בקו דק (Lucide-style), inline SVG
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 20, children, ...rest }: P) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <I {...p}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z" /></I>
);
export const CalendarIcon = (p: P) => (
  <I {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></I>
);
export const UserIcon = (p: P) => (
  <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></I>
);
export const UsersIcon = (p: P) => (
  <I {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" /></I>
);
export const BellIcon = (p: P) => (
  <I {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></I>
);
export const PlusIcon = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const ChevronLeft = (p: P) => <I {...p}><path d="M15 6l-6 6 6 6" /></I>;
export const ChevronRight = (p: P) => <I {...p}><path d="M9 6l6 6-6 6" /></I>;
export const CheckIcon = (p: P) => <I {...p}><path d="M5 12l5 5L20 7" /></I>;
export const XIcon = (p: P) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>;
export const EditIcon = (p: P) => (
  <I {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></I>
);
export const ClockIcon = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>;
export const SunIcon = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>
);
export const NoonIcon = (p: P) => (
  <I {...p}><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9V2M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 10.2L17 11.6M22 22H2" /></I>
);
export const MoonIcon = (p: P) => <I {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></I>;
export const PhoneIcon = (p: P) => (
  <I {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.7a2 2 0 0 1 1.7 2z" /></I>
);
export const WhatsAppIcon = (p: P) => (
  <I {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l2-4.6A8.4 8.4 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" /></I>
);
export const MessageIcon = (p: P) => (
  <I {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></I>
);
export const SettingsIcon = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>
);
export const SparkleIcon = (p: P) => (
  <I {...p}><path d="M12 3l1.8 4.6 4.9.4-3.7 3.2 1.1 4.8L12 13.5 7.9 16l1.1-4.8L5.3 8l4.9-.4z" /></I>
);
export const GiftIcon = (p: P) => (
  <I {...p}><path d="M20 12v8H4v-8" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></I>
);
export const RefreshIcon = (p: P) => <I {...p}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></I>;
export const InfoIcon = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></I>;
export const LogoutIcon = (p: P) => (
  <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></I>
);
export const BanIcon = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></I>;

// אייקון המותג: לוח שנה עם נצנץ
export const BrandIcon = ({ size = 22, ...rest }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <rect x="3" y="5" width="18" height="16" rx="4" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M12 13l1 2.2 2.2 1-2.2 1L12 19.5l-1-2.3-2.2-1 2.2-1z" fill="currentColor" stroke="none" />
  </svg>
);
