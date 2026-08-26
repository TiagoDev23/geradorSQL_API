import { cx } from "./cx";

/**
 * Tabela densa. A rolagem horizontal fica no contêiner, de modo que
 * colunas largas nunca empurram a página.
 */
export function TableFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "scroll-slim overflow-x-auto rounded-lg border border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse text-sm">{children}</table>;
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-line px-3 py-2 text-[12px] font-medium tracking-wide text-ink-muted uppercase whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  mono = false,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <td
      className={cx(
        "border-b border-line px-3 py-2 text-ink",
        align === "right" ? "text-right tabular-nums" : "text-left",
        mono && "font-mono text-[12.5px]",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cx("transition-colors hover:bg-muted/60", className)}>
      {children}
    </tr>
  );
}
