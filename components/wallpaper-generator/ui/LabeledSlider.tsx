export function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  accent: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] text-wp-2">{label}</span>
        <span className="font-mono text-[12px] text-wp-2 tabular-nums">{display}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-wp-fill">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%`, background: accent }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
