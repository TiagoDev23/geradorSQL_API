import { cx } from "./cx";

/** Indicador numérico da visão geral. Um número e um rótulo, nada mais. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border border-line bg-surface px-4 py-3.5",
        className,
      )}
    >
      <p className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">
        {label}
      </p>

      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>

      {hint ? (
        <p className="mt-0.5 text-[12px] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
