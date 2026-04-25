export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-wp-2">
      {options.map(([v, label]) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="wp-interactive flex-1 py-2 text-[12px] font-medium transition-colors"
            style={
              active && accent
                ? { color: accent, background: `${accent}18` }
                : undefined
            }
            data-active={active}
          >
            <span
              className={
                active && !accent
                  ? "text-wp-1"
                  : !active
                    ? "text-wp-3 hover:text-wp-2"
                    : undefined
              }
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
