import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cx } from "./cx";

const BASE =
  "w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-ink-subtle transition-colors hover:border-line-strong " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 " +
  "disabled:bg-muted disabled:text-ink-muted";

export function Input({
  className,
  mono,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return (
    <input
      className={cx(BASE, "h-9", mono && "font-mono text-[13px]", className)}
      {...rest}
    />
  );
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cx(BASE, "py-2 leading-6", className)} {...rest} />
  );
}
