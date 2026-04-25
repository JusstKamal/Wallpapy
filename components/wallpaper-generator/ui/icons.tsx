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

export function CloseSmIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
