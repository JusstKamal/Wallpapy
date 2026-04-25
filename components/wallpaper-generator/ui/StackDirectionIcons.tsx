export function HStackIcon({ active, accent }: { active: boolean; accent: string }) {
  const c = active ? accent : "var(--wp-t4)";
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none" aria-hidden>
      {[0, 7, 14, 21].map((x, i) => (
        <rect
          key={x}
          x={x}
          y="0"
          width="11"
          height="20"
          rx="5.5"
          fill={c}
          opacity={(i + 1) * 0.25}
        />
      ))}
    </svg>
  );
}

export function VStackIcon({ active, accent }: { active: boolean; accent: string }) {
  const c = active ? accent : "var(--wp-t4)";
  return (
    <svg width="20" height="32" viewBox="0 0 20 32" fill="none" aria-hidden>
      {[0, 7, 14, 21].map((y, i) => (
        <rect
          key={y}
          x="0"
          y={y}
          width="20"
          height="11"
          rx="5.5"
          fill={c}
          opacity={(i + 1) * 0.25}
        />
      ))}
    </svg>
  );
}
