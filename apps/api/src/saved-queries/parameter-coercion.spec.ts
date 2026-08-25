import { BadRequestException } from '@nestjs/common';

import { QueryParameterType } from '../generated/prisma/enums';
import {
  buildParameterValues,
  coerceParameter,
  ParameterDefinition,
} from './parameter-coercion';

function param(
  type: QueryParameterType,
  overrides: Partial<ParameterDefinition> = {},
): ParameterDefinition {
  return {
    name: 'valor',
    type,
    position: 1,
    required: true,
    defaultValue: null,
    ...overrides,
  };
}

describe('parameter-coercion', () => {
  describe('obrigatoriedade', () => {
    it('rejeita parâmetro obrigatório ausente', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.STRING), undefined),
      ).toThrow(/obrigatório/);
    });

    it('rejeita parâmetro obrigatório vazio', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.STRING), '   '),
      ).toThrow(/obrigatório/);
    });

    it('devolve null para parâmetro opcional ausente', () => {
      expect(
        coerceParameter(
          param(QueryParameterType.STRING, { required: false }),
          undefined,
        ),
      ).toBeNull();
    });

    it('usa o valor padrão quando o parâmetro não é informado', () => {
      expect(
        coerceParameter(
          param(QueryParameterType.INTEGER, { defaultValue: '42' }),
          undefined,
        ),
      ).toBe(42);
    });

    it('valor informado tem precedência sobre o padrão', () => {
      expect(
        coerceParameter(
          param(QueryParameterType.INTEGER, { defaultValue: '42' }),
          '7',
        ),
      ).toBe(7);
    });
  });

  describe('INTEGER', () => {
    it('converte texto numérico', () => {
      expect(coerceParameter(param(QueryParameterType.INTEGER), '10')).toBe(10);
    });

    it('aceita negativo', () => {
      expect(coerceParameter(param(QueryParameterType.INTEGER), '-3')).toBe(-3);
    });

    it('rejeita texto não numérico', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.INTEGER), 'abc'),
      ).toThrow(BadRequestException);
    });

    it('rejeita número fracionário', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.INTEGER), '1.5'),
      ).toThrow(/inteiro/);
    });

    it('rejeita valor fora da faixa segura', () => {
      expect(() =>
        coerceParameter(
          param(QueryParameterType.INTEGER),
          '99999999999999999999',
        ),
      ).toThrow(BadRequestException);
    });

    it('não converte silenciosamente texto parcialmente numérico', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.INTEGER), '12abc'),
      ).toThrow(BadRequestException);
    });
  });

  describe('FLOAT', () => {
    it('converte decimal', () => {
      expect(coerceParameter(param(QueryParameterType.FLOAT), '1.5')).toBe(1.5);
    });

    it('aceita notação científica', () => {
      expect(coerceParameter(param(QueryParameterType.FLOAT), '1e3')).toBe(
        1000,
      );
    });

    it('rejeita texto inválido', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.FLOAT), 'abc'),
      ).toThrow(BadRequestException);
    });

    it('rejeita Infinity', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.FLOAT), 'Infinity'),
      ).toThrow(BadRequestException);
    });
  });

  describe('BOOLEAN', () => {
    it.each(['true', 'TRUE', 't', '1', 'yes', 'sim'])(
      'aceita %s como verdadeiro',
      (entrada) => {
        expect(
          coerceParameter(param(QueryParameterType.BOOLEAN), entrada),
        ).toBe(true);
      },
    );

    it.each(['false', 'FALSE', 'f', '0', 'no', 'nao'])(
      'aceita %s como falso',
      (entrada) => {
        expect(
          coerceParameter(param(QueryParameterType.BOOLEAN), entrada),
        ).toBe(false);
      },
    );

    it('rejeita representação não prevista', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.BOOLEAN), 'talvez'),
      ).toThrow(/booleano/);
    });
  });

  describe('DATE', () => {
    it('aceita formato AAAA-MM-DD', () => {
      expect(
        coerceParameter(param(QueryParameterType.DATE), '2026-08-21'),
      ).toBe('2026-08-21');
    });

    it('rejeita outro formato', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.DATE), '21/08/2026'),
      ).toThrow(BadRequestException);
    });

    it('rejeita data inexistente no calendário', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.DATE), '2026-02-31'),
      ).toThrow(BadRequestException);
    });
  });

  describe('DATETIME', () => {
    it('converte ISO 8601 para Date', () => {
      const resultado = coerceParameter(
        param(QueryParameterType.DATETIME),
        '2026-08-21T10:30:00Z',
      );

      expect(resultado).toBeInstanceOf(Date);
      expect((resultado as Date).toISOString()).toBe(
        '2026-08-21T10:30:00.000Z',
      );
    });

    it('rejeita texto que não é data', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.DATETIME), 'ontem'),
      ).toThrow(BadRequestException);
    });
  });

  describe('UUID', () => {
    it('aceita UUID válido', () => {
      const uuid = '11111111-1111-4111-8111-111111111111';

      expect(coerceParameter(param(QueryParameterType.UUID), uuid)).toBe(uuid);
    });

    it('rejeita UUID malformado', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.UUID), '1234'),
      ).toThrow(/UUID/);
    });
  });

  describe('STRING', () => {
    it('preserva o texto', () => {
      expect(coerceParameter(param(QueryParameterType.STRING), ' texto ')).toBe(
        'texto',
      );
    });

    it('rejeita objeto', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.STRING), { a: 1 }),
      ).toThrow(BadRequestException);
    });

    it('rejeita array, que poderia alterar a semântica da consulta', () => {
      expect(() =>
        coerceParameter(param(QueryParameterType.STRING), ['a', 'b']),
      ).toThrow(BadRequestException);
    });
  });

  describe('buildParameterValues', () => {
    it('ordena os valores pela posição, não pela ordem recebida', () => {
      const definicoes: ParameterDefinition[] = [
        param(QueryParameterType.DATE, {
          name: 'ate',
          position: 3,
        }),
        param(QueryParameterType.INTEGER, {
          name: 'estacaoId',
          position: 1,
        }),
        param(QueryParameterType.DATE, {
          name: 'de',
          position: 2,
        }),
      ];

      expect(
        buildParameterValues(definicoes, {
          de: '2026-08-01',
          ate: '2026-08-08',
          estacaoId: '5',
        }),
      ).toEqual([5, '2026-08-01', '2026-08-08']);
    });

    it('devolve lista vazia quando não há parâmetros', () => {
      expect(buildParameterValues([], {})).toEqual([]);
    });

    it('ignora chaves recebidas que não foram declaradas', () => {
      const definicoes = [
        param(QueryParameterType.INTEGER, { name: 'estacaoId' }),
      ];

      expect(
        buildParameterValues(definicoes, {
          estacaoId: '1',
          naoDeclarado: 'x',
        }),
      ).toEqual([1]);
    });
  });
});
