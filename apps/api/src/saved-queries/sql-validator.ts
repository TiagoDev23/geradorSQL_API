import { BadRequestException } from '@nestjs/common';

/**
 * Camada de validação de SQL para o MVP: apenas leitura.
 *
 * A verificação não se apoia em inspecionar o início da string, que é
 * contornável. O texto passa antes por uma normalização que substitui
 * comentários, literais e identificadores entre aspas por espaços; só o
 * que sobra é analisado. Com isso, uma palavra proibida escondida em um
 * comentário não bloqueia indevidamente, e um comando escondido depois
 * de um comentário não escapa da análise.
 */

/**
 * Comandos incompatíveis com um escopo somente leitura. Inclui escrita,
 * DDL, controle de transação, manipulação de sessão e comandos capazes
 * de tocar o sistema de arquivos do servidor.
 */
const FORBIDDEN_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
  'copy',
  'merge',
  'call',
  'do',
  'execute',
  'prepare',
  'deallocate',
  'vacuum',
  'analyze',
  'reindex',
  'cluster',
  'lock',
  'set',
  'reset',
  'discard',
  'begin',
  'commit',
  'rollback',
  'savepoint',
  'listen',
  'notify',
  'unlisten',
  'refresh',
  'comment',
  'import',
  'load',
  'checkpoint',
  // SELECT ... INTO cria tabela.
  'into',
];

/**
 * Funções que leem ou escrevem fora do banco, ou que permitem prender a
 * conexão. Não são comandos, portanto não seriam pegas pela lista acima.
 */
const FORBIDDEN_FUNCTIONS = [
  'pg_read_file',
  'pg_read_binary_file',
  'pg_ls_dir',
  'pg_stat_file',
  'pg_sleep',
  'pg_sleep_for',
  'pg_sleep_until',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'lo_import',
  'lo_export',
  'dblink',
  'dblink_exec',
];

const ALLOWED_FIRST_KEYWORDS = ['select', 'with', 'table', 'values'];

/**
 * Substitui por espaços tudo aquilo cujo conteúdo não deve ser
 * interpretado como comando: comentários de linha e de bloco, literais
 * entre aspas simples, blocos com dollar quoting e identificadores
 * entre aspas duplas.
 *
 * Os espaços preservam as fronteiras entre palavras, evitando que a
 * remoção junte dois tokens em um.
 */
export function stripNonExecutable(sql: string): string {
  let result = '';
  let index = 0;

  while (index < sql.length) {
    const rest = sql.slice(index);

    // Comentário de linha.
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', index);
      const stop = end === -1 ? sql.length : end;

      result += ' '.repeat(stop - index);
      index = stop;

      continue;
    }

    // Comentário de bloco, que no PostgreSQL pode ser aninhado.
    if (rest.startsWith('/*')) {
      let depth = 1;
      let cursor = index + 2;

      while (cursor < sql.length && depth > 0) {
        if (sql.startsWith('/*', cursor)) {
          depth += 1;
          cursor += 2;
        } else if (sql.startsWith('*/', cursor)) {
          depth -= 1;
          cursor += 2;
        } else {
          cursor += 1;
        }
      }

      result += ' '.repeat(cursor - index);
      index = cursor;

      continue;
    }

    // Literal entre aspas simples. Duas aspas seguidas são escape.
    if (rest.startsWith("'")) {
      let cursor = index + 1;

      while (cursor < sql.length) {
        if (sql[cursor] === "'") {
          if (sql[cursor + 1] === "'") {
            cursor += 2;

            continue;
          }

          cursor += 1;

          break;
        }

        cursor += 1;
      }

      result += ' '.repeat(cursor - index);
      index = cursor;

      continue;
    }

    // Identificador entre aspas duplas.
    if (rest.startsWith('"')) {
      let cursor = index + 1;

      while (cursor < sql.length) {
        if (sql[cursor] === '"') {
          if (sql[cursor + 1] === '"') {
            cursor += 2;

            continue;
          }

          cursor += 1;

          break;
        }

        cursor += 1;
      }

      result += ' '.repeat(cursor - index);
      index = cursor;

      continue;
    }

    // Dollar quoting. O marcador posicional $1 não casa com este
    // padrão, porque exige um segundo cifrão fechando a etiqueta.
    const dollarTag = /^\$([A-Za-z_]\w*)?\$/.exec(rest);

    if (dollarTag) {
      const tag = dollarTag[0];
      const closing = sql.indexOf(tag, index + tag.length);
      const stop = closing === -1 ? sql.length : closing + tag.length;

      result += ' '.repeat(stop - index);
      index = stop;

      continue;
    }

    result += sql[index];
    index += 1;
  }

  return result;
}

/**
 * Posições dos marcadores presentes na consulta, em ordem crescente e
 * sem repetição. Lê apenas o texto executável, para que um `$1` dentro
 * de um literal não seja contado.
 */
export function extractPlaceholders(sql: string): number[] {
  const executable = stripNonExecutable(sql);
  const found = new Set<number>();

  for (const match of executable.matchAll(/\$(\d+)/g)) {
    found.add(Number(match[1]));
  }

  return [...found].sort((first, second) => first - second);
}

/**
 * Garante que a consulta é uma leitura única e sem comandos proibidos.
 * Lança BadRequestException com mensagem específica quando não é.
 */
export function assertReadOnlySelect(sql: string): void {
  if (typeof sql !== 'string' || sql.trim().length === 0) {
    throw new BadRequestException('A consulta SQL não pode ser vazia.');
  }

  const executable = stripNonExecutable(sql);

  // Um ponto e vírgula final é aceito; qualquer outro indica mais de
  // uma instrução.
  const withoutTrailing = executable.replace(/;\s*$/, '');

  if (withoutTrailing.includes(';')) {
    throw new BadRequestException(
      'A consulta deve conter uma única instrução SQL.',
    );
  }

  const normalized = withoutTrailing.trim();

  if (normalized.length === 0) {
    throw new BadRequestException('A consulta SQL não pode ser vazia.');
  }

  const firstKeyword = /^[a-zA-Z_]\w*/.exec(normalized)?.[0].toLowerCase();

  if (!firstKeyword || !ALLOWED_FIRST_KEYWORDS.includes(firstKeyword)) {
    throw new BadRequestException(
      'Somente consultas de leitura iniciadas por SELECT ou WITH são permitidas.',
    );
  }

  const lowered = normalized.toLowerCase();

  for (const keyword of FORBIDDEN_KEYWORDS) {
    // A fronteira \b não casa dentro de identificadores como
    // "create_date", porque o sublinhado conta como caractere de
    // palavra.
    if (new RegExp(`\\b${keyword}\\b`).test(lowered)) {
      throw new BadRequestException(
        `A consulta contém o comando "${keyword.toUpperCase()}", não permitido em consultas de leitura.`,
      );
    }
  }

  for (const fn of FORBIDDEN_FUNCTIONS) {
    if (new RegExp(`\\b${fn}\\s*\\(`).test(lowered)) {
      throw new BadRequestException(
        `A consulta utiliza a função "${fn}", não permitida.`,
      );
    }
  }
}
