import { BadRequestException } from '@nestjs/common';

import { QueryParameterType } from '../generated/prisma/enums';

/**
 * Conversão dos valores recebidos por HTTP para os tipos declarados em
 * QueryParameter, antes de serem entregues ao driver.
 *
 * A conversão é estrita: um valor que não corresponde ao tipo declarado
 * resulta em erro, nunca em coerção silenciosa. Aceitar "abc" como zero,
 * por exemplo, produziria um resultado plausível e errado.
 */

export interface ParameterDefinition {
  name: string;
  type: QueryParameterType;
  position: number;
  required: boolean;
  defaultValue: string | null;
}

/** Representações textuais aceitas para BOOLEAN. */
const TRUE_LITERALS = ['true', 't', '1', 'yes', 'sim'];
const FALSE_LITERALS = ['false', 'f', '0', 'no', 'nao', 'não'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(parameter: ParameterDefinition, esperado: string): never {
  throw new BadRequestException(
    `O parâmetro "${parameter.name}" deve ser ${esperado}.`,
  );
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length === 0)
  );
}

/**
 * Converte um único valor. Devolve `null` quando o parâmetro é opcional
 * e não foi informado — o driver envia NULL, e a consulta decide o que
 * fazer com isso.
 */
export function coerceParameter(
  parameter: ParameterDefinition,
  rawValue: unknown,
): string | number | boolean | Date | null {
  let value = rawValue;

  if (isEmpty(value)) {
    if (!isEmpty(parameter.defaultValue)) {
      value = parameter.defaultValue;
    } else if (parameter.required) {
      throw new BadRequestException(
        `O parâmetro "${parameter.name}" é obrigatório.`,
      );
    } else {
      return null;
    }
  }

  // Valores vindos de query string chegam sempre como texto; valores
  // vindos de um corpo JSON podem já ter tipo. Estruturas compostas são
  // recusadas: converter um objeto em texto produziria um valor sem
  // sentido para a consulta.
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    invalid(parameter, 'um valor simples');
  }

  const text = String(value).trim();

  switch (parameter.type) {
    case QueryParameterType.STRING:
      return text;

    case QueryParameterType.INTEGER: {
      if (!/^-?\d+$/.test(text)) {
        invalid(parameter, 'um número inteiro');
      }

      const parsed = Number(text);

      if (!Number.isSafeInteger(parsed)) {
        invalid(parameter, 'um número inteiro dentro da faixa suportada');
      }

      return parsed;
    }

    case QueryParameterType.FLOAT: {
      if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) {
        invalid(parameter, 'um número');
      }

      const parsed = Number(text);

      if (!Number.isFinite(parsed)) {
        invalid(parameter, 'um número');
      }

      return parsed;
    }

    case QueryParameterType.BOOLEAN: {
      const lowered = text.toLowerCase();

      if (TRUE_LITERALS.includes(lowered)) {
        return true;
      }

      if (FALSE_LITERALS.includes(lowered)) {
        return false;
      }

      invalid(parameter, 'um valor booleano (true ou false)');

      break;
    }

    case QueryParameterType.DATE: {
      if (!DATE_PATTERN.test(text)) {
        invalid(parameter, 'uma data no formato AAAA-MM-DD');
      }

      // Verifica se a data existe de fato: 2026-02-31 casa com o
      // padrão, mas não é uma data.
      const parsed = new Date(`${text}T00:00:00Z`);

      if (Number.isNaN(parsed.getTime())) {
        invalid(parameter, 'uma data válida');
      }

      if (parsed.toISOString().slice(0, 10) !== text) {
        invalid(parameter, 'uma data existente no calendário');
      }

      // Enviada como texto: o PostgreSQL converte para DATE no contexto
      // da consulta, sem introduzir componente de fuso horário.
      return text;
    }

    case QueryParameterType.DATETIME: {
      const parsed = new Date(text);

      if (Number.isNaN(parsed.getTime())) {
        invalid(parameter, 'uma data e hora no formato ISO 8601');
      }

      return parsed;
    }

    case QueryParameterType.UUID: {
      if (!UUID_PATTERN.test(text)) {
        invalid(parameter, 'um UUID válido');
      }

      return text;
    }

    default:
      invalid(parameter, 'de um tipo suportado');
  }
}

/**
 * Monta o array de valores na ordem exigida pelos marcadores
 * posicionais. O índice do array corresponde a `position - 1`, de modo
 * que o primeiro elemento alimenta `$1`.
 */
export function buildParameterValues(
  parameters: ParameterDefinition[],
  received: Record<string, unknown>,
): (string | number | boolean | Date | null)[] {
  const ordered = [...parameters].sort(
    (first, second) => first.position - second.position,
  );

  return ordered.map((parameter) =>
    coerceParameter(parameter, received[parameter.name]),
  );
}
