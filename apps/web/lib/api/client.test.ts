import { API_BASE_URL } from "../config";
import { ApiError, request } from "./client";
import { clearToken, writeToken } from "../auth/session";

/**
 * O cliente HTTP é o ponto por onde passa toda a comunicação com a
 * API: URL, autenticação e tradução de erro.
 */

function respondWith(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

  global.fetch = fetchMock as unknown as typeof fetch;

  return fetchMock;
}

function lastRequest(fetchMock: jest.Mock): [string, RequestInit] {
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

describe("request", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("monta a URL a partir da base configurada", async () => {
    const fetchMock = respondWith(200, { ok: true });

    await request("/projects");

    expect(lastRequest(fetchMock)[0]).toBe(`${API_BASE_URL}/projects`);
  });

  it("envia o token da sessão no cabeçalho Authorization", async () => {
    writeToken("token-de-teste");

    const fetchMock = respondWith(200, []);

    await request("/projects");

    const headers = lastRequest(fetchMock)[1].headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer token-de-teste");
  });

  it("não envia token em rotas anônimas", async () => {
    writeToken("token-de-teste");

    const fetchMock = respondWith(200, {});

    await request("/auth/login", {
      method: "POST",
      body: { email: "a@b.c" },
      anonymous: true,
    });

    const headers = lastRequest(fetchMock)[1].headers as Record<string, string>;

    expect(headers.Authorization).toBeUndefined();
  });

  it("usa a primeira mensagem devolvida pela validação do backend", async () => {
    respondWith(400, {
      statusCode: 400,
      message: ["A senha deve ter entre 8 e 128 caracteres.", "outra"],
    });

    await expect(request("/auth/signup", { anonymous: true })).rejects.toThrow(
      "A senha deve ter entre 8 e 128 caracteres.",
    );
  });

  it("preserva o status do erro", async () => {
    respondWith(404, { message: "Projeto não encontrado." });

    await expect(request("/projects/x")).rejects.toMatchObject({
      status: 404,
      message: "Projeto não encontrado.",
    });
  });

  it("descarta a sessão ao receber 401", async () => {
    writeToken("token-expirado");
    respondWith(401, { message: "Token de acesso inválido." });

    await expect(request("/projects")).rejects.toBeInstanceOf(ApiError);

    expect(window.localStorage.getItem("apigen.access-token")).toBeNull();
  });

  it("preserva a sessão quando o 401 vem de um login recusado", async () => {
    writeToken("token-valido");
    respondWith(401, { message: "Credenciais inválidas." });

    await expect(
      request("/auth/login", { anonymous: true }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(window.localStorage.getItem("apigen.access-token")).toBe(
      "token-valido",
    );
  });

  it("traduz falha de rede em mensagem segura", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:3001"));

    await expect(request("/health")).rejects.toMatchObject({
      status: 0,
      message: "Não foi possível contactar o servidor.",
    });
  });

  afterEach(() => {
    clearToken();
  });
});
