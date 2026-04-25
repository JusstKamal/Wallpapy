import { ExportSpinner } from "./icons";

export function ExportBusyOverlay({ accent }: { accent: string }) {
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: "var(--wp-overlay)" }}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div
        className="wp-interactive flex flex-col items-center gap-3 rounded-2xl border border-wp-2 bg-wp-panel px-8 py-6 shadow-2xl"
        style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}
      >
        <ExportSpinner className="h-9 w-9 text-wp-4" accent={accent} />
        <p className="text-[13px] text-wp-2">Preparing export…</p>
      </div>
    </div>
  );
}
