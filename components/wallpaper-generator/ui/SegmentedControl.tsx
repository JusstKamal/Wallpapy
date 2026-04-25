export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-wp-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`wp-interactive flex-1 py-2 text-[12px] font-medium ${
            value === v
              ? "bg-wp-fill-2 text-wp-1"
              : "text-wp-3 hover:text-wp-2"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
