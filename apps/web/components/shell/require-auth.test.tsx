import { render, screen } from "@testing-library/react";

import { useAuth } from "@/lib/auth/auth-context";
import { RequireAuth } from "./require-auth";

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: jest.fn(),
}));

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;

function withStatus(status: "loading" | "authenticated" | "anonymous") {
  useAuthMock.mockReturnValue({
    status,
    user: null,
    accept: jest.fn(),
    signOut: jest.fn(),
  });
}

describe("RequireAuth", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("não renderiza conteúdo autenticado enquanto a sessão é confirmada", () => {
    withStatus("loading");

    render(
      <RequireAuth>
        <p>conteúdo do painel</p>
      </RequireAuth>,
    );

    expect(screen.queryByText("conteúdo do painel")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("envia para o login quando não há sessão", () => {
    withStatus("anonymous");

    render(
      <RequireAuth>
        <p>conteúdo do painel</p>
      </RequireAuth>,
    );

    expect(screen.queryByText("conteúdo do painel")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renderiza o conteúdo quando a sessão está confirmada", () => {
    withStatus("authenticated");

    render(
      <RequireAuth>
        <p>conteúdo do painel</p>
      </RequireAuth>,
    );

    expect(screen.getByText("conteúdo do painel")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
