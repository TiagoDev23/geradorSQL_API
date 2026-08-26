import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as apiKeysApi from "@/lib/api/api-keys";
import type { ApiKey, ProjectDetail } from "@/lib/api/types";
import { ToastProvider } from "@/components/ui/toast";
import ApiKeysPage from "./page";

jest.mock("@/lib/api/api-keys");

const project: ProjectDetail = {
  id: "p1",
  name: "Clima Demo",
  slug: "clima-demo",
  description: null,
  ownerId: "u1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: { connections: 1, endpoints: 1, apiKeys: 1 },
};

jest.mock("@/lib/project-context", () => ({
  useProject: () => ({ project, reload: jest.fn() }),
}));

const listApiKeys = apiKeysApi.listApiKeys as jest.MockedFunction<
  typeof apiKeysApi.listApiKeys
>;

const createApiKey = apiKeysApi.createApiKey as jest.MockedFunction<
  typeof apiKeysApi.createApiKey
>;

const TOKEN = "gapi_abcdefghijklmnopqrstuvwxyz0123456789";

function apiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "k1",
    name: "Integração",
    keyPrefix: "gapi_abcdefg",
    projectId: "p1",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <ToastProvider>
      <ApiKeysPage />
    </ToastProvider>,
  );
}

describe("ApiKeysPage", () => {
  beforeEach(() => {
    listApiKeys.mockReset();
    createApiKey.mockReset();
  });

  it("lista apenas metadados, nunca o valor da chave", async () => {
    listApiKeys.mockResolvedValue([apiKey()]);

    renderPage();

    expect(await screen.findByText("Integração")).toBeInTheDocument();
    expect(screen.getByText("gapi_abcdefg…")).toBeInTheDocument();
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it("mostra o valor completo uma única vez e o descarta ao fechar", async () => {
    // Uma chave já existente evita que o estado vazio duplique o botão
    // de criação.
    listApiKeys.mockResolvedValue([apiKey({ id: "k0", name: "Antiga" })]);
    createApiKey.mockResolvedValue({
      ...apiKey(),
      token: TOKEN,
      warning: "Guarde esta chave: ela não poderá ser exibida novamente.",
    });

    const user = userEvent.setup();

    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Criar API Key" }),
    );

    await user.type(screen.getByLabelText(/Nome/), "Integração");

    // Depois da criação a listagem é recarregada; ela devolve apenas
    // metadados, como o backend faz.
    listApiKeys.mockResolvedValue([apiKey()]);

    await user.click(screen.getByRole("button", { name: "Criar" }));

    expect(await screen.findByText(TOKEN)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entendi" }));

    await waitFor(() =>
      expect(screen.queryByText(TOKEN)).not.toBeInTheDocument(),
    );

    // E não há nenhum caminho de volta ao valor completo.
    expect(screen.queryByText(new RegExp(TOKEN))).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando o projeto não tem chaves", async () => {
    listApiKeys.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Nenhuma API Key.")).toBeInTheDocument();
  });
});
