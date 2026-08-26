import "@testing-library/jest-dom";

// A área de transferência não existe no jsdom; os testes que verificam
// cópia só precisam saber que o valor foi entregue.
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: jest.fn().mockResolvedValue(undefined) },
  configurable: true,
});
