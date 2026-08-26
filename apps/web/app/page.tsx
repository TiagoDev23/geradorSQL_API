"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth/auth-context";

/**
 * A raiz não tem conteúdo próprio: encaminha para os projetos ou para o
 * login, conforme a sessão. A decisão depende do `localStorage` e por
 * isso acontece no cliente.
 */
export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/projects");
    }

    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  return null;
}
