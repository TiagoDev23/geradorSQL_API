/** Junta classes condicionais sem depender de biblioteca. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
