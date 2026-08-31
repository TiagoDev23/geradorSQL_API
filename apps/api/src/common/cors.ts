/**
 * Origens autorizadas a chamar a API pelo navegador.
 *
 * A lista é sempre explícita. Curinga não é opção: o painel envia o JWT
 * no cabeçalho `Authorization` e o runtime aceita `x-api-key`, e liberar
 * qualquer origem permitiria que qualquer página fizesse essas chamadas
 * com credenciais que o usuário já tem no navegador.
 */

export const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

/**
 * Converte o valor de `CORS_ORIGINS` em lista.
 *
 * Entradas vazias são descartadas: `CORS_ORIGINS=""` ou uma vírgula
 * sobrando produziriam uma origem em branco, que não corresponde a
 * nenhuma origem real mas polui a configuração. Quando nada sobra,
 * vale o padrão de desenvolvimento.
 */
export function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    // O curinga é descartado junto com as entradas vazias: as
    // requisições da plataforma levam credencial, e "*" não é uma
    // origem válida nesse caso.
    .filter((origin) => origin.length > 0 && origin !== '*');

  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}
