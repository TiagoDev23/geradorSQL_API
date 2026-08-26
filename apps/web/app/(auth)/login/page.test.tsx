import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import LoginPage from "./page";

jest.mock("@/lib/api/auth");

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: jest.fn(),
}));

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const login = authApi.login as jest.MockedFunction<typeof authApi.login>;
const accept = jest.fn();
const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;

describe("LoginPage", () => {
  beforeEach(() => {
    replace.mockClear();
    accept.mockClear();
    login.mockReset();

    useAuthMock.mockReturnValue({
      status: "anonymous",
      user: null,
      accept,
      signOut: jest.fn(),
    });
  });

  async function preencher() {
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/E-mail/), "tiago@exemplo.com");
    await user.type(screen.getByLabelText(/Senha/), "senha-secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    return user;
  }

  it("assume a sessão e entra no painel", async () => {
    const result = {
      accessToken: "jwt",
      user: {
        id: "u1",
        name: null,
        email: "tiago@exemplo.com",
        createdAt: "",
        updatedAt: "",
      },
    };

    login.mockResolvedValue(result);

    render(<LoginPage />);
    await preencher();

    expect(login).toHaveBeenCalledWith({
      email: "tiago@exemplo.com",
      password: "senha-secreta",
    });

    expect(accept).toHaveBeenCalledWith(result);
    expect(replace).toHaveBeenCalledWith("/projects");
  });

  it("mostra a mensagem do backend quando as credenciais falham", async () => {
    login.mockRejectedValue(new ApiError(401, "Credenciais inválidas."));

    render(<LoginPage />);
    await preencher();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credenciais inválidas.",
    );

    expect(accept).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
