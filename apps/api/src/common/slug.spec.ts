import { isValidSlug, normalizeSlug, VERSION_PATTERN } from './slug';

describe('slug', () => {
  describe('normalizeSlug', () => {
    it.each([
      ['Observações Recentes', 'observacoes-recentes'],
      ['observacoes recentes', 'observacoes-recentes'],
      ['/observacoes', 'observacoes'],
      ['observacoes?teste=1', 'observacoes-teste-1'],
      ['Farmácia Demo', 'farmacia-demo'],
      ['  espaços  ', 'espacos'],
      ['MAIÚSCULAS', 'maiusculas'],
    ])('normaliza %s', (entrada, esperado) => {
      expect(normalizeSlug(entrada)).toBe(esperado);
    });

    it('devolve vazio quando não sobra nenhum caractere útil', () => {
      expect(normalizeSlug('///')).toBe('');
    });
  });

  describe('isValidSlug', () => {
    it.each(['observacoes-recentes', 'v1', 'resumo', 'a1-b2-c3'])(
      'aceita %s',
      (slug) => {
        expect(isValidSlug(slug)).toBe(true);
      },
    );

    it.each([
      'Observações Recentes',
      'observacoes recentes',
      '/observacoes',
      'observacoes?teste=1',
      'observacoes--duplo',
      '-inicio',
      'fim-',
      '',
    ])('rejeita %s', (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    });
  });

  describe('VERSION_PATTERN', () => {
    it.each(['v1', 'v2', 'v10'])('aceita %s', (versao) => {
      expect(VERSION_PATTERN.test(versao)).toBe(true);
    });

    it.each(['1', 'V1', 'v0', 'v1.0', 'versao1', 'v-1'])(
      'rejeita %s',
      (versao) => {
        expect(VERSION_PATTERN.test(versao)).toBe(false);
      },
    );
  });
});
