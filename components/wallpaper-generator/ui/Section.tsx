import type { ReactNode } from "react";

export function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-wp px-4 py-3.5 sm:py-4">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-wp-4">
        {label}
      </p>
      {children}
    </div>
  );
}
