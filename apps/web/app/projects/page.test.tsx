import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/lib/api/client";
import * as projectsApi from "@/lib/api/projects";
import type { Project } from "@/lib/api/types";
import ProjectsPage from "./page";

jest.mock("@/lib/api/projects");

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", name: "Tiago", email: "tiago@exemplo.com" },
    accept: jest.fn(),
    signOut: jest.fn(),
  }),
}));

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => "/projects",
}));

const listProjects = projectsApi.listProjects as jest.MockedFunction<
  typeof projectsApi.listProjects
>;

const createProject = projectsApi.createProject as jest.MockedFunction<
  typeof projectsApi.createProject
>;

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Clima Demo",
    slug: "clima-demo",
    description: null,
    ownerId: "u1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    push.mockClear();
    listProjects.mockReset();
    createProject.mockReset();
  });

  it("lista os projetos do usuário", async () => {
    listProjects.mockResolvedValue([project()]);

    render(<ProjectsPage />);

    expect(await screen.findByText("Clima Demo")).toBeInTheDocument();
    expect(screen.getByText("clima-demo")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há projetos", async () => {
    listProjects.mockResolvedValue([]);

    render(<ProjectsPage />);

    expect(await screen.findByText("Nenhum projeto ainda.")).toBeInTheDocument();
  });

  it("mostra a mensagem do backend quando a listagem falha", async () => {
    listProjects.mockRejectedValue(new ApiError(401, "Sessão expirada."));

    render(<ProjectsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sessão expirada.",
    );
  });

  it("cria um projeto e abre o projeto criado", async () => {
    // Com a lista preenchida, o botão de criar existe apenas no
    // cabeçalho e no diálogo.
    listProjects.mockResolvedValue([project()]);
    createProject.mockResolvedValue(project({ id: "novo" }));

    const user = userEvent.setup();

    render(<ProjectsPage />);

    await user.click(await screen.findByRole("button", { name: "Novo projeto" }));
    await user.type(screen.getByLabelText(/Nome/), "Clima Demo");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));

    await waitFor(() =>
      expect(createProject).toHaveBeenCalledWith({ name: "Clima Demo" }),
    );

    expect(push).toHaveBeenCalledWith("/projects/novo");
  });
});
