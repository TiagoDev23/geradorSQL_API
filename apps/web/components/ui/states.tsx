import { cx } from "./cx";

/**
 * Estado vazio. O texto é curto de propósito: uma frase e a ação que
 * resolve a ausência.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>

        {description ? (
          <p className="text-[13px] text-ink-muted">{description}</p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

/** Falha de carregamento, com a mensagem segura devolvida pela API. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cx(
        "flex flex-col items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3",
        className,
      )}
    >
      <p className="text-[13px] text-danger">{message}</p>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-[13px] font-medium text-danger underline underline-offset-2"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

/** Erro dentro de um formulário, acima dos botões. */
export function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] text-danger"
    >
      {message}
    </p>
  );
}
