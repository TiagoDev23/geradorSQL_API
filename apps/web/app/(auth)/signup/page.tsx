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

export default function SignupPage() {
  const { status, accept } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // O cadastro já devolve o token: não há segunda etapa de login.
      accept(
        await authApi.signup({
          email,
          password,
          ...(name.trim() && { name: name.trim() }),
        }),
      );

      router.replace("/projects");
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Criar conta</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Publique endpoints REST a partir de consultas SQL.
        </p>
      </div>

      <Field label="Nome" htmlFor="name" hint="Opcional.">
        <Input
          id="name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

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

      <Field
        label="Senha"
        htmlFor="password"
        required
        hint="Entre 8 e 128 caracteres."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <FormError message={error} />

      <Button type="submit" variant="primary" loading={busy}>
        Criar conta
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary">
          Entrar
        </Link>
      </p>
    </form>
  );
}
