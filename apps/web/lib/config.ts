/**
 * Configuração da aplicação web.
 *
 * O nome do produto ainda não é definitivo; ele existe em um único
 * lugar para que a troca futura não precise varrer a interface.
 */
export const PRODUCT_NAME = "API Generator";

export const PRODUCT_TAGLINE = "Conecte. Consulte. Publique.";

/**
 * Base da API NestJS. Sem variável definida, assume o servidor local
 * de desenvolvimento descrito no CLAUDE.md.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
).replace(/\/+$/, "");
