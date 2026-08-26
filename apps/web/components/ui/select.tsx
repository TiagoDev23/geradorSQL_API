import type { SelectHTMLAttributes } from "react";

import { cx } from "./cx";

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-9 w-full appearance-none rounded-md border border-line bg-surface px-2.5 pr-8 text-sm text-ink",
        "transition-colors hover:border-line-strong focus:border-primary focus:outline-none",
        "focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-ink-muted",
        // Seta desenhada em CSS: evita depender de biblioteca de ícones.
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22 fill=%22none%22 stroke=%22%23667085%22 stroke-width=%221.5%22><path d=%22M3 4.5 6 7.5 9 4.5%22/></svg>')]",
        "bg-[length:12px] bg-[position:right_10px_center] bg-no-repeat",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
