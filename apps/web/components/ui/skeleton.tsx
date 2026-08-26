import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

/** Espaço reservado para listas e tabelas durante o carregamento. */
export function SkeletonRows({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10" />
      ))}
    </div>
  );
}
