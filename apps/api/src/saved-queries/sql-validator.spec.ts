import { BadRequestException } from '@nestjs/common';

import {
  assertReadOnlySelect,
  extractPlaceholders,
  stripNonExecutable,
} from './sql-validator';

describe('sql-validator', () => {
  describe('assertReadOnlySelect', () => {
    it('aceita SELECT simples', () => {
      expect(() => assertReadOnlySelect('SELECT 1')).not.toThrow();
    });

    it('aceita SELECT com marcadores posicionais', () => {
      expect(() =>
        assertReadOnlySelect(
          'SELECT * FROM meteorologia.observacoes WHERE estacao_id = $1',
        ),
      ).not.toThrow();
    });

    it('aceita consulta agregada com JOIN e GROUP BY', () => {
      expect(() =>
        assertReadOnlySelect(`
          SELECT e.id, AVG(o.temperatura) AS media
          FROM meteorologia.observacoes o
          JOIN referencia.estacoes e ON e.id = o.estacao_id
          WHERE o.observado_em >= $1
          GROUP BY e.id
          ORDER BY e.id
        `),
      ).not.toThrow();
    });

    it('aceita CTE iniciada por WITH', () => {
      expect(() =>
        assertReadOnlySelect('WITH base AS (SELECT 1 AS n) SELECT n FROM base'),
      ).not.toThrow();
    });

    it('aceita ponto e vírgula final', () => {
      expect(() => assertReadOnlySelect('SELECT 1;')).not.toThrow();
    });

    it.each([
      ['INSERT', "INSERT INTO estados (sigla) VALUES ('XX')"],
      ['UPDATE', 'UPDATE referencia.estados SET nome = 1'],
      ['DELETE', 'DELETE FROM referencia.estados'],
      ['DROP', 'DROP TABLE referencia.estados'],
      ['ALTER', 'ALTER TABLE referencia.estados ADD COLUMN x int'],
      ['CREATE', 'CREATE TABLE t (id int)'],
      ['TRUNCATE', 'TRUNCATE referencia.estados'],
      ['GRANT', 'GRANT ALL ON estados TO demo'],
      ['REVOKE', 'REVOKE ALL ON estados FROM demo'],
      ['COPY', "COPY estados FROM '/etc/passwd'"],
    ])('bloqueia %s', (_nome, sql) => {
      expect(() => assertReadOnlySelect(sql)).toThrow(BadRequestException);
    });

    it('bloqueia comando de escrita escondido após um SELECT', () => {
      expect(() =>
        assertReadOnlySelect('SELECT 1; DROP TABLE referencia.estados'),
      ).toThrow(/única instrução/);
    });

    it('bloqueia escrita escondida depois de um comentário de linha', () => {
      expect(() =>
        assertReadOnlySelect(
          'SELECT 1 -- comentário\nDELETE FROM referencia.estados',
        ),
      ).toThrow(BadRequestException);
    });

    it('bloqueia SELECT INTO, que cria tabela', () => {
      expect(() =>
        assertReadOnlySelect('SELECT * INTO nova FROM referencia.estados'),
      ).toThrow(BadRequestException);
    });

    it('bloqueia CTE que escreve dados', () => {
      expect(() =>
        assertReadOnlySelect(
          'WITH removidos AS (DELETE FROM referencia.estados RETURNING *) SELECT * FROM removidos',
        ),
      ).toThrow(BadRequestException);
    });

    it('bloqueia funções que tocam o sistema de arquivos', () => {
      expect(() =>
        assertReadOnlySelect("SELECT pg_read_file('/etc/passwd')"),
      ).toThrow(/pg_read_file/);
    });

    it('bloqueia pg_sleep, que prenderia a conexão', () => {
      expect(() => assertReadOnlySelect('SELECT pg_sleep(100)')).toThrow(
        /pg_sleep/,
      );
    });

    it('rejeita SQL vazio', () => {
      expect(() => assertReadOnlySelect('   ')).toThrow(BadRequestException);
    });

    it('rejeita consulta que é apenas um comentário', () => {
      expect(() => assertReadOnlySelect('-- nada aqui')).toThrow(
        BadRequestException,
      );
    });

    it('não confunde identificador que contém palavra proibida', () => {
      // "create_date" e "updated_at" não são comandos.
      expect(() =>
        assertReadOnlySelect(
          'SELECT create_date, updated_at, deleted_flag FROM tabela',
        ),
      ).not.toThrow();
    });

    it('não bloqueia palavra proibida dentro de um literal', () => {
      expect(() =>
        assertReadOnlySelect(
          "SELECT * FROM eventos WHERE descricao = 'houve um DELETE'",
        ),
      ).not.toThrow();
    });

    it('não bloqueia palavra proibida dentro de comentário', () => {
      expect(() =>
        assertReadOnlySelect('SELECT 1 /* poderia ser um UPDATE */'),
      ).not.toThrow();
    });
  });

  describe('stripNonExecutable', () => {
    it('preserva o comprimento do texto', () => {
      const sql = "SELECT 'abc' -- fim";

      expect(stripNonExecutable(sql)).toHaveLength(sql.length);
    });

    it('remove o conteúdo de literais e comentários', () => {
      const limpo = stripNonExecutable("SELECT 'DELETE' /* DROP */ FROM t");

      expect(limpo).not.toContain('DELETE');
      expect(limpo).not.toContain('DROP');
      expect(limpo).toContain('SELECT');
      expect(limpo).toContain('FROM t');
    });
  });

  describe('extractPlaceholders', () => {
    it('devolve as posições em ordem e sem repetição', () => {
      expect(
        extractPlaceholders(
          'SELECT * FROM t WHERE a = $2 AND b = $1 AND c = $2',
        ),
      ).toEqual([1, 2]);
    });

    it('devolve lista vazia quando não há marcadores', () => {
      expect(extractPlaceholders('SELECT 1')).toEqual([]);
    });

    it('ignora marcador dentro de literal', () => {
      expect(extractPlaceholders("SELECT '$1' FROM t WHERE a = $1")).toEqual([
        1,
      ]);
    });

    it('não confunde dollar quoting com marcador', () => {
      expect(extractPlaceholders('SELECT $tag$ texto $1 $tag$ FROM t')).toEqual(
        [],
      );
    });
  });
});
