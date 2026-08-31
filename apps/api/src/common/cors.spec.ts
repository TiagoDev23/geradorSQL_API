import { DEFAULT_CORS_ORIGINS, parseCorsOrigins } from './cors';

describe('parseCorsOrigins', () => {
  it('usa o padrão de desenvolvimento quando a variável não existe', () => {
    expect(parseCorsOrigins(undefined)).toEqual(DEFAULT_CORS_ORIGINS);
  });

  it('usa o padrão quando a variável está vazia', () => {
    // Sem este tratamento, "".split(',') produziria uma origem em
    // branco na lista de permitidas.
    expect(parseCorsOrigins('')).toEqual(DEFAULT_CORS_ORIGINS);
    expect(parseCorsOrigins('   ')).toEqual(DEFAULT_CORS_ORIGINS);
    expect(parseCorsOrigins(',,')).toEqual(DEFAULT_CORS_ORIGINS);
  });

  it('aceita uma única origem', () => {
    expect(parseCorsOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
    ]);
  });

  it('separa múltiplas origens e remove espaços', () => {
    expect(
      parseCorsOrigins(' http://localhost:3000 , https://painel.exemplo '),
    ).toEqual(['http://localhost:3000', 'https://painel.exemplo']);
  });

  it('descarta entradas vazias entre origens válidas', () => {
    expect(parseCorsOrigins('http://localhost:3000,,')).toEqual([
      'http://localhost:3000',
    ]);
  });

  it('nunca devolve curinga', () => {
    // O curinga é incompatível com requisições que levam credencial;
    // se aparecesse aqui, seria por engano de configuração.
    for (const value of ['*', ' * ', undefined, '']) {
      expect(parseCorsOrigins(value)).not.toContain('*');
    }
  });
});
