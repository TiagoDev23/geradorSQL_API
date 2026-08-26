"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import * as authApi from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/auth-context";
import { errorMessage } from "@/lib/use-resource";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/states";

export default function LoginPage() {
  const { status, accept } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quem já tem sessão não precisa passar por aqui.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/projects");
    }
  }, [status, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError(null);

    try {
      accept(await authApi.login({ email, password }));

      router.replace("/projects");
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Entrar</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Acesse seus projetos e endpoints.
        </p>
      </div>

      <Field label="E-mail" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label="Senha" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <FormError message={error} />

      <Button type="submit" variant="primary" loading={busy}>
        Entrar
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        Não tem conta?{" "}
        <Link href="/signup" className="font-medium text-primary">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
