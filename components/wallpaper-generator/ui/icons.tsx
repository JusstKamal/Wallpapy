export function PaletteDragHandleIcon() {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      className="pointer-events-none"
      aria-hidden
    >
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(0 ${row * 5})`}>
          <circle cx="2.5" cy="2" r="1.15" fill="currentColor" />
          <circle cx="7.5" cy="2" r="1.15" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

export function PillIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect
        x="1"
        y="3"
        width="5"
        height="8"
        rx="2.5"
        fill="currentColor"
        opacity="0.7"
      />
      <rect x="8" y="3" width="5" height="8" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
    </svg>
  );
}

export function EyedropperIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 2a2.83 2.83 0 0 1 4 4l-1.5 1.5-4-4L11 2Z" />
      <path d="M9.5 3.5 3 10l-.5 3.5L6 13l6.5-6.5" />
      <path d="m2 14 1-1" />
    </svg>
  );
}

export function ShuffleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 3h3v3M3 13l10-10M13 10v3h-3M3 3l4 4" />
    </svg>
  );
}

export function ExportSpinner({
  className,
  accent,
}: {
  className?: string;
  accent: string;
}) {
  return (
    <svg
      className={`shrink-0 animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
