export function ToggleSwitch({
  checked,
  onChange,
  accent,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  accent: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="wp-interactive relative h-6 w-11 shrink-0 rounded-full"
      style={{
        background: checked ? accent : "var(--wp-knob-off)",
      }}
    >
      <div
        className="absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
        style={{
          left: checked ? "calc(100% - 22px)" : "2px",
          background: checked ? "var(--wp-on-accent)" : "var(--wp-knob-thumb)",
        }}
      />
    </button>
  );
}

export function ToggleSwitchSm({
  checked,
  onChange,
  accent,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  accent: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="wp-interactive relative h-5 w-9 rounded-full"
      style={{
        background: checked ? accent : "var(--wp-knob-off)",
      }}
    >
      <div
        className="absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
        style={{
          left: checked ? "calc(100% - 18px)" : "2px",
          background: checked ? "var(--wp-on-accent)" : "var(--wp-knob-thumb)",
        }}
      />
    </button>
  );
}
