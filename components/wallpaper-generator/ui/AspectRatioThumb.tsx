export function AspectRatioThumb({
  w,
  h,
  active,
  accent,
}: {
  w: number;
  h: number;
  active: boolean;
  accent: string;
}) {
  const maxW = 28,
    maxH = 22;
  const ratio = w / h;
  let tw: number, th: number;
  if (ratio >= 1) {
    tw = maxW;
    th = Math.round((maxW * h) / w);
    if (th > maxH) {
      th = maxH;
      tw = Math.max(Math.round((maxH * w) / h), 4);
    }
  } else {
    th = maxH;
    tw = Math.round((maxH * w) / h);
    if (tw > maxW) {
      tw = maxW;
      th = Math.max(Math.round((maxW * h) / w), 4);
    }
  }
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: maxW, height: maxH }}
    >
      <div
        className="rounded-[2px] border"
        style={{
          width: tw,
          height: th,
          background: active ? `${accent}22` : "var(--wp-fill)",
          borderColor: active ? accent : "var(--wp-border-2)",
        }}
      />
    </div>
  );
}
