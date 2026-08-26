import { formatCell, formatDuration, previewSlug } from "./format";

describe("previewSlug", () => {
  it("reproduz a normalização do backend", () => {
    expect(previewSlug("Farmácia Demo")).toBe("farmacia-demo");
    expect(previewSlug("  Clima   Demo  ")).toBe("clima-demo");
    expect(previewSlug("Observações/Estação")).toBe("observacoes-estacao");
  });

  it("devolve texto vazio quando não sobra nada aproveitável", () => {
    expect(previewSlug("---")).toBe("");
  });
});

describe("formatCell", () => {
  it("distingue null de texto vazio", () => {
    expect(formatCell(null)).toEqual({ text: "null", isNull: true });
    expect(formatCell("")).toEqual({ text: "", isNull: false });
  });

  it("serializa valores compostos", () => {
    expect(formatCell({ a: 1 }).text).toBe('{"a":1}');
  });
});

describe("formatDuration", () => {
  it("mostra traço quando a métrica não existe", () => {
    expect(formatDuration(null)).toBe("—");
  });
});
