/** Formatações usadas em várias telas. */

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

const number = new Intl.NumberFormat("pt-BR");

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function formatDate(value: string | null | undefined): string {
  return value ? date.format(new Date(value)) : "—";
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : number.format(value);
}

export function formatDuration(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : `${number.format(value)} ms`;
}

/** Distância aproximada até agora, para listagens. */
export function formatRelative(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `há ${hours} h`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `há ${days} d`;

  return formatDate(value);
}

/**
 * Mesma normalização aplicada pelo backend, usada só para pré-visualizar
 * o slug enquanto o usuário digita. O valor gravado continua sendo o
 * que o backend decidir.
 */
export function previewSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Valor de célula de resultado, preservando a distinção de `null`. */
export function formatCell(value: unknown): {
  text: string;
  isNull: boolean;
} {
  if (value === null || value === undefined) {
    return { text: "null", isNull: true };
  }

  if (typeof value === "object") {
    return { text: JSON.stringify(value), isNull: false };
  }

  return { text: String(value), isNull: false };
}
