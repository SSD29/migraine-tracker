// Small line-icon set (24×24, stroke-based) so the app needs no icon library.
const PATHS = {
  today: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </>
  ),
  patterns: <path d="M5 20v-8M12 20V5M19 20v-5M3 20.5h18" />,
  report: (
    <>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7.5h9M18 7.5h2M4 16.5h3M11 16.5h9" />
      <circle cx="15.5" cy="7.5" r="2.25" />
      <circle cx="8.5" cy="16.5" r="2.25" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  checkin: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2.5" />
      <path d="M9 3.5h6v2.5H9zM9 13l2 2 4-4.5" />
    </>
  ),
  check: <path d="m5.5 12.5 4 4 9-9.5" />,
  pen: <path d="M4.5 19.5h4l10-10a2.12 2.12 0 0 0-4-4l-10 10z" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2.5" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  cloud: <path d="M7.5 18.5h9.5a4 4 0 0 0 .4-7.98 5.5 5.5 0 0 0-10.6 1.06A3.5 3.5 0 0 0 7.5 18.5z" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  shield: <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** The app mark: a clock face, matching public/icon.svg. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="120" fill="var(--logo-bg)" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="var(--logo-fg)" strokeWidth="36" />
      <path d="M256 150v106l70 44" fill="none" stroke="var(--logo-fg)" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
